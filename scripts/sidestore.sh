#!/bin/bash
# SideStore용 주간 시간표 IPA를 만들고, 같은 Wi-Fi에서 받을 수 있는 소스를 띄운다.
# 7일 재서명은 폰의 SideStore가 한다. 이 스크립트는 최초 설치와 앱 업데이트용이다.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ARCHIVE="$ROOT/build/WeeklyScheduleApp.xcarchive"
APP="$ARCHIVE/Products/Applications/WeeklyScheduleApp.app"
OUT="$ROOT/dist/sidestore"
IPA="$OUT/WeeklyScheduleApp.ipa"
PORT="${SIDESTORE_PORT:-8741}"
ICON_SRC="$ROOT/WeeklyScheduleApp/Assets.xcassets/AppIcon.appiconset/icon_512x512.png"

lan_ip() {
  ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true
}

write_source() {
  local ip="$1"
  local size version date url
  size="$(stat -f%z "$IPA")"
  version="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$APP/Info.plist" 2>/dev/null || echo 1.0.0)"
  date="$(date +%Y-%m-%dT%H:%M:%S%z | sed -E 's/([0-9]{2})([0-9]{2})$/\1:\2/')"
  if [[ -n "$ip" ]]; then
    url="http://${ip}:${PORT}"
  else
    url="http://127.0.0.1:${PORT}"
  fi
  cp "$ICON_SRC" "$OUT/icon.png"
  cat > "$OUT/source.json" <<EOF
{
  "name": "주간 시간표",
  "identifier": "com.jae.weeklyschedule.source",
  "sourceURL": "${url}/source.json",
  "apps": [
    {
      "name": "주간 시간표",
      "bundleIdentifier": "com.jae.weeklyschedule.app",
      "developerName": "Jaeheon Kim",
      "subtitle": "아이·부모 주간 시간표",
      "version": "${version}",
      "versionDate": "${date}",
      "versionDescription": "SideStore 재서명용 개인 빌드",
      "downloadURL": "${url}/WeeklyScheduleApp.ipa",
      "localizedDescription": "무료 Apple ID로 설치하면 7일마다 SideStore가 다시 서명한다. 설치·갱신할 때는 LocalDevVPN이 연결되어 있어야 한다.",
      "iconURL": "${url}/icon.png",
      "tintColor": "#7D9B8A",
      "size": ${size}
    }
  ]
}
EOF
  echo "$url/source.json"
}

build_ipa() {
  mkdir -p "$OUT" "$ROOT/build"
  rm -rf "$ARCHIVE"
  xcodebuild \
    -project "$ROOT/WeeklyScheduleApp.xcodeproj" \
    -scheme WeeklyScheduleApp \
    -configuration Release \
    -destination 'generic/platform=iOS' \
    -archivePath "$ARCHIVE" \
    CODE_SIGNING_ALLOWED=NO \
    CODE_SIGNING_REQUIRED=NO \
    CODE_SIGN_IDENTITY="" \
    archive
  if [[ ! -d "$APP" ]]; then
    echo "archive에 WeeklyScheduleApp.app이 없다: $APP" >&2
    exit 1
  fi
  # SideStore가 자기 인증서로 다시 서명한다. 여기 서명은 번들이 비지 않게 하는 ad-hoc뿐이다.
  codesign --force --deep --sign - --timestamp=none "$APP"
  local stage="$ROOT/build/ipa-root"
  rm -rf "$stage"
  mkdir -p "$stage/Payload"
  cp -R "$APP" "$stage/Payload/"
  rm -f "$IPA"
  (cd "$stage" && zip -qr "$IPA" Payload)
  write_source "$(lan_ip)" >/dev/null
  echo "IPA: $IPA ($(stat -f%z "$IPA") bytes)"
}

serve() {
  if [[ ! -f "$IPA" || ! -d "$APP" ]]; then
    build_ipa
  fi
  local ip url
  ip="$(lan_ip)"
  url="$(write_source "$ip")"
  echo "SideStore 소스: $url"
  echo "같은 Wi-Fi의 아이폰에서 연다. 끝내려면 Ctrl-C."
  exec python3 -m http.server "$PORT" --bind 0.0.0.0 --directory "$OUT"
}

case "${1:-build}" in
  build) build_ipa ;;
  serve) serve ;;
  *)
    echo "usage: $0 [build|serve]" >&2
    exit 2
    ;;
esac
