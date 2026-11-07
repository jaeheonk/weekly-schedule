#!/bin/bash
# WeeklyScheduleApp personal-team refresh (Xcode, no AltStore, no password stored)
# Same pattern as toon-viewer-native/tools/refresh-devices.sh.
# Schedule: Mon + Thu 02:20. A failed / skipped device is retried on the
# next scheduled run. If no target device is visible, the build is skipped
# and the next scheduled run retries. iOS target only; the
# WeeklyScheduleMac target is not built.
set -u
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

PROJECT="/Users/jae/Workspace/weekly-schedule"
DERIVED_DATA="$PROJECT/build/DerivedData"
APP="$DERIVED_DATA/Build/Products/Debug-iphoneos/WeeklyScheduleApp.app"
LOG_DIR="/Users/jae/Library/Logs"
LOG="$LOG_DIR/weekly-schedule-refresh.log"
BUNDLE_ID="com.jae.weeklyschedule.app"

mkdir -p "$LOG_DIR"
{
echo "=== $(date '+%Y-%m-%d %H:%M:%S %Z') refresh start ==="
DEVICES=("Jaeheon의 iPhone" "Bluelock" "hana의 iPhone")
VISIBLE=()
REQUIRED_UDIDS=()
while IFS=$'\t' read -r NAME UDID AVAILABLE; do
  if [ "$NAME" = "MISSING" ]; then
    echo "SKIP (not in Xcode): $UDID"
    continue
  fi
  REQUIRED_UDIDS+=("$UDID")
  if [ "$AVAILABLE" = "yes" ]; then
    VISIBLE+=("$NAME")
  else
    echo "SKIP (not visible): $NAME (not connected / locked / untrusted)"
  fi
done < <(python3 "$PROJECT/tools/renew-provisioning-profile.py" device-udids "${DEVICES[@]}")
if [ ${#REQUIRED_UDIDS[@]} -eq 0 ]; then
  echo "ERROR: none of the target devices are known to Xcode."
  exit 1
fi
cd "$PROJECT" || { echo "ERROR: cannot cd to $PROJECT"; exit 1; }
# A still-valid profile is reused, so the 7-day clock never moves. Remove the
# local profiles first; Xcode then issues new ones. Also remove the built app
# and widget so an unchanged project is signed again.
WIDGET_ID="${BUNDLE_ID}.widget"
WIDGET_APPEX="$DERIVED_DATA/Build/Products/Debug-iphoneos/WeeklyScheduleWidgetExtension.appex"
PROFILE_BACKUP="$HOME/Library/Developer/Xcode/UserData/Provisioning Profile Backups"
python3 "$PROJECT/tools/renew-provisioning-profile.py" preserve-complete "$PROFILE_BACKUP" "$BUNDLE_ID" "$WIDGET_ID" -- "${REQUIRED_UDIDS[@]}" || \
  echo "No saved profile yet contains every target device."
PROFILE_STAMP=$(date +%s)
python3 "$PROJECT/tools/renew-provisioning-profile.py" prepare "$PROFILE_STAMP" "$BUNDLE_ID" "$WIDGET_ID" || \
  echo "New profile was not ready before the build; xcodebuild will try to create it."
rm -rf "$APP" "$WIDGET_APPEX"
BUILD_OK=0
for ATTEMPT in 1 2 3; do
  BUILD_LOG=$(mktemp)
  if xcodebuild \
    -project WeeklyScheduleApp.xcodeproj \
    -scheme WeeklyScheduleApp \
    -configuration Debug \
    -destination 'generic/platform=iOS' \
    -derivedDataPath "$DERIVED_DATA" \
    -allowProvisioningUpdates \
    build >"$BUILD_LOG" 2>&1; then
    cat "$BUILD_LOG"
    rm -f "$BUILD_LOG"
    BUILD_OK=1
    break
  fi
  cat "$BUILD_LOG"
  if ! grep -E -q "No profiles|No Accounts|requires a provisioning profile" "$BUILD_LOG"; then
    rm -f "$BUILD_LOG"
    echo "ERROR: xcodebuild failed; nothing was installed. Will retry on the next scheduled run."
    exit 1
  fi
  rm -f "$BUILD_LOG"
  echo "Provisioning profile is not ready (attempt $ATTEMPT/3); waiting 5s."
  sleep 5
done
if [ "$BUILD_OK" -ne 1 ]; then
  echo "ERROR: xcodebuild failed; nothing was installed. Will retry on the next scheduled run."
  exit 1
fi
if ! python3 "$PROJECT/tools/renew-provisioning-profile.py" ensure-devices "$PROFILE_BACKUP" "$APP/PlugIns/WeeklyScheduleWidgetExtension.appex" "$APP" -- "${REQUIRED_UDIDS[@]}"; then
  echo "ERROR: signed app does not include every target device; nothing was installed."
  exit 1
fi
if [ ${#VISIBLE[@]} -eq 0 ]; then
  echo "READY: app is signed for every target device, but none is connected to install."
  exit 0
fi
if [ ! -d "$APP" ]; then
  echo "ERROR: built app not found at $APP"
  exit 1
fi
echo "Built: $APP"
OVERALL=0
for DEVICE in "${VISIBLE[@]}"; do
  # Wi-Fi devices can drop off devicectl during a long build and reappear
  # a moment later. Xcode Run keeps the device connection alive, but a
  # separate devicectl install after the build does not, so retry the
  # install a few times instead of failing on the first 'not found'.
  INSTALLED=0
  for ATTEMPT in 1 2 3; do
    echo "Installing on $DEVICE (attempt $ATTEMPT/3) ..."
    if xcrun devicectl device install app --device "$DEVICE" "$APP"; then
      echo "OK: installed $BUNDLE_ID on $DEVICE"
      INSTALLED=1
      break
    fi
    echo "Install attempt $ATTEMPT failed for $DEVICE; waiting 20s for Wi-Fi device to reappear..."
    sleep 20
  done
  if [ "$INSTALLED" -eq 0 ]; then
    echo "FAILED: install on $DEVICE (unlock + trust the device and retry on the next scheduled run; if the profile does not include this device yet, run once from Xcode on that device first)"
    OVERALL=1
  fi
done
echo "=== refresh finished (status=$OVERALL) ==="
exit $OVERALL
} >> "$LOG" 2>&1
