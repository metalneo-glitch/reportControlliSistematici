#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ASSETS_DIR="$ROOT_DIR/assets"
LOGO_JPG="$ASSETS_DIR/logo.jpg"
OUT_JS="$ASSETS_DIR/logo.inline.js"

if [ ! -f "$LOGO_JPG" ]; then
  echo "Logo file not found: $LOGO_JPG" >&2
  exit 1
fi

# Generate data URL for the logo
if command -v base64 >/dev/null 2>&1; then
  B64="$(base64 -w0 "$LOGO_JPG")"
else
  # macOS base64 doesn't support -w
  B64="$(base64 "$LOGO_JPG" | tr -d '\n')"
fi

printf 'window.LOGO_DATA_URL="data:image/jpeg;base64,%s";\n' "$B64" > "$OUT_JS"

echo "Updated: $OUT_JS"
