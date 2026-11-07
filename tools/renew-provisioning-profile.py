#!/usr/bin/env python3
"""Drop local Xcode profiles so this run gets a new 7-day profile.

Deleting the local file is what makes Xcode issue a new profile. A still-valid
profile is otherwise reused, and the 7-day clock does not move.
"""

from __future__ import annotations

import json
import plistlib
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

PROFILE_DIR = Path.home() / "Library/Developer/Xcode/UserData/Provisioning Profiles"
SKEW_SECONDS = 180
WAIT_SECONDS = 25


def decode(path: Path) -> dict:
    data = subprocess.check_output(
        ["security", "cms", "-D", "-i", str(path)],
        stderr=subprocess.DEVNULL,
    )
    return plistlib.loads(data)


def matches(profile: dict, bundle_ids: list[str]) -> bool:
    app_id = str(profile.get("Entitlements", {}).get("application-identifier", ""))
    name = str(profile.get("Name", ""))
    for bundle_id in bundle_ids:
        if app_id == bundle_id or app_id.endswith("." + bundle_id):
            return True
        if name == f"iOS Team Provisioning Profile: {bundle_id}":
            return True
    return False


def created_at(profile: dict) -> datetime:
    created = profile["CreationDate"]
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    return created


def describe(profile: dict) -> str:
    created = created_at(profile).astimezone()
    expires = profile["ExpirationDate"]
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    expires = expires.astimezone()
    return (
        f"{profile.get('Name')} uuid={profile.get('UUID')} "
        f"created={created.strftime('%Y-%m-%d %H:%M:%S %Z')} "
        f"expires={expires.strftime('%Y-%m-%d %H:%M:%S %Z')}"
    )


def local_profiles(bundle_ids: list[str]) -> list[tuple[Path, dict]]:
    found = []
    if not PROFILE_DIR.is_dir():
        return found
    for path in sorted(PROFILE_DIR.glob("*.mobileprovision")):
        try:
            profile = decode(path)
        except (subprocess.CalledProcessError, plistlib.InvalidFileException, KeyError, ValueError):
            continue
        if matches(profile, bundle_ids):
            found.append((path, profile))
    return found


def prepare(started: float, bundle_ids: list[str]) -> int:
    for path, profile in local_profiles(bundle_ids):
        path.unlink()
        print(f"Removed local profile {describe(profile)}")
    deadline = time.time() + WAIT_SECONDS
    while True:
        fresh = [
            (path, profile)
            for path, profile in local_profiles(bundle_ids)
            if created_at(profile).timestamp() >= started - SKEW_SECONDS
        ]
        covered = set()
        for _, profile in fresh:
            app_id = str(profile.get("Entitlements", {}).get("application-identifier", ""))
            name = str(profile.get("Name", ""))
            for bundle_id in bundle_ids:
                if app_id.endswith("." + bundle_id) or name.endswith(bundle_id):
                    covered.add(bundle_id)
        if covered == set(bundle_ids):
            for _, profile in fresh:
                print(f"New profile {describe(profile)}")
            return 0
        if time.time() >= deadline:
            missing = [bundle_id for bundle_id in bundle_ids if bundle_id not in covered]
            print(
                "New profile not ready yet for "
                + ", ".join(missing)
                + ". The build will try to create it."
            )
            return 2
        time.sleep(1)


SIGN_IDENTITY = "638F3D6242E4BCFA581B8211D7920F22FD282215"


def device_rows(names: list[str]) -> int:
    raw = subprocess.check_output(["xcrun", "xcdevice", "list"], stderr=subprocess.DEVNULL)
    by_name = {}
    for device in json.loads(raw):
        if device.get("simulator"):
            continue
        name = str(device.get("name") or "")
        by_name.setdefault(name.strip(), device)
    missing = False
    for wanted in names:
        device = by_name.get(wanted.strip())
        if device is None:
            print(f"MISSING\t{wanted}")
            missing = True
            continue
        available = "yes" if device.get("available") else "no"
        print(f"{device.get('name')}\t{device.get('identifier')}\t{available}")
    return 1 if missing else 0


def profile_has_udids(profile: dict, udids: list[str]) -> bool:
    have = set(profile.get("ProvisionedDevices") or [])
    return all(udid in have for udid in udids)


def preserve_complete(backup_dir: Path, bundle_ids: list[str], udids: list[str]) -> int:
    backup_dir.mkdir(parents=True, exist_ok=True)
    kept = 0
    for path, profile in local_profiles(bundle_ids):
        if not profile_has_udids(profile, udids):
            print(f"Not keeping incomplete profile {describe(profile)}")
            continue
        dest = backup_dir / path.name
        shutil.copy2(path, dest)
        kept += 1
        print(f"Kept installable profile {describe(profile)}")
    return 0 if kept else 2


def matching_backup(backup_dir: Path, current: dict, udids: list[str]) -> Path | None:
    app_id = str(current.get("Entitlements", {}).get("application-identifier", ""))
    found = None
    for path in sorted(backup_dir.glob("*.mobileprovision")):
        try:
            profile = decode(path)
        except (subprocess.CalledProcessError, plistlib.InvalidFileException, KeyError, ValueError):
            continue
        other = str(profile.get("Entitlements", {}).get("application-identifier", ""))
        if other == app_id and profile_has_udids(profile, udids):
            found = path
    return found


def resign_bundle(bundle: Path, profile_path: Path) -> None:
    profile = decode(profile_path)
    entitlements = Path("/tmp") / f"{bundle.name}.entitlements.plist"
    with entitlements.open("wb") as handle:
        plistlib.dump(profile["Entitlements"], handle)
    shutil.copy2(profile_path, bundle / "embedded.mobileprovision")
    subprocess.check_call(
        [
            "codesign",
            "--force",
            "--sign",
            SIGN_IDENTITY,
            "--timestamp=none",
            "--generate-entitlement-der",
            "--entitlements",
            str(entitlements),
            str(bundle),
        ]
    )
    print(f"Re-signed {bundle.name} with {describe(profile)}")


def ensure_devices(backup_dir: Path, bundles: list[str], udids: list[str]) -> int:
    failed = False
    # Sign nested appex bundles before the containing app.
    ordered = sorted((Path(raw) for raw in bundles), key=lambda path: len(path.parts), reverse=True)
    for bundle in ordered:
        embedded = bundle / "embedded.mobileprovision"
        if not embedded.is_file():
            print(f"ERROR: no embedded profile at {embedded}")
            failed = True
            continue
        current = decode(embedded)
        if profile_has_udids(current, udids):
            print(f"Installable profile in {bundle.name}: {describe(current)}")
            continue
        replacement = matching_backup(backup_dir, current, udids)
        if replacement is None:
            print(f"ERROR: no saved profile for {bundle.name} contains all target devices")
            failed = True
            continue
        print(f"New profile omitted a target device; restoring {replacement.name}")
        resign_bundle(bundle, replacement)
    return 1 if failed else 0


def verify(started: float, app_paths: list[str]) -> int:
    failed = False
    for raw in app_paths:
        path = Path(raw)
        profile_path = path / "embedded.mobileprovision"
        if not profile_path.is_file():
            print(f"ERROR: no embedded profile at {profile_path}")
            failed = True
            continue
        profile = decode(profile_path)
        created = created_at(profile)
        if created.timestamp() < started - SKEW_SECONDS:
            print(f"ERROR: stale profile in {path.name}: {describe(profile)}")
            failed = True
            continue
        print(f"Fresh profile in {path.name}: {describe(profile)}")
    return 1 if failed else 0


def main() -> int:
    if len(sys.argv) < 2:
        print(
            "usage: renew-provisioning-profile.py prepare|verify|device-udids|preserve-complete|ensure-devices ...",
            file=sys.stderr,
        )
        return 1
    command = sys.argv[1]
    if command == "device-udids":
        return device_rows(sys.argv[2:])
    if command == "preserve-complete":
        backup = Path(sys.argv[2])
        separator = sys.argv.index("--")
        return preserve_complete(backup, sys.argv[3:separator], sys.argv[separator + 1 :])
    if command == "ensure-devices":
        backup = Path(sys.argv[2])
        separator = sys.argv.index("--")
        return ensure_devices(backup, sys.argv[3:separator], sys.argv[separator + 1 :])
    if len(sys.argv) < 3:
        print("usage: renew-provisioning-profile.py prepare|verify <unix-start> ...", file=sys.stderr)
        return 1
    started = float(sys.argv[2])
    if command == "prepare":
        return prepare(started, sys.argv[3:])
    if command == "verify":
        return verify(started, sys.argv[3:])
    print(f"unknown command {command}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
