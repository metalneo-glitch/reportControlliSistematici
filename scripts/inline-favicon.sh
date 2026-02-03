#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ASSETS_DIR="$ROOT_DIR/assets"
FAVICON_PNG="$ASSETS_DIR/favicon.png"
OUT_JS="$ASSETS_DIR/favicon.inline.js"

if [ ! -f "$FAVICON_PNG" ]; then
  echo "Favicon file not found: $FAVICON_PNG" >&2
  exit 1
fi

python3 - <<'PY'
from pathlib import Path
import base64

root = Path(__file__).resolve().parent.parent
favicon = root / "assets" / "favicon.png"
out_js = root / "assets" / "favicon.inline.js"

b64 = base64.b64encode(favicon.read_bytes()).decode("ascii")
data_url = f"data:image/png;base64,{b64}"

out_js.write_text(f'window.FAVICON_DATA_URL="{data_url}";\n', encoding="utf-8")
print(f"Wrote: {out_js}")
PY
