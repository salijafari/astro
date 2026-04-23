#!/usr/bin/env bash
set -euo pipefail
echo "$GOOGLE_SERVICE_INFO_PLIST" > ./config/GoogleService-Info.plist
echo "GoogleService-Info.plist written successfully"
