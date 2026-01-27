#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_HTML="$ROOT_DIR/index.html"
OUT_HTML="$ROOT_DIR/dist/single.html"

python3 - <<'PY'
from pathlib import Path
import re

root = Path(__file__).resolve().parent.parent
src = root / "index.html"
out = root / "dist" / "single.html"

html = src.read_text(encoding="utf-8")

def inline_css(html: str, href: str) -> str:
    path = root / href
    css = path.read_text(encoding="utf-8")
    tag = f'<link rel="stylesheet" href="{href}" />'
    repl = f'<style>\n{css}\n</style>'
    if tag not in html:
        raise SystemExit(f"Missing tag for CSS: {tag}")
    return html.replace(tag, repl, 1)

def inline_js(html: str, src_path: str) -> str:
    path = root / src_path
    js = path.read_text(encoding="utf-8")
    tag = f'<script src="{src_path}"></script>'
    repl = f'<script>\n{js}\n</script>'
    if tag not in html:
        raise SystemExit(f"Missing tag for JS: {tag}")
    return html.replace(tag, repl, 1)

html = inline_css(html, "style.css")

# Inline JS in the same order as index.html
for js in [
    "libs/jspdf.umd.min.js",
    "libs/jspdf-autotable.min.js",
    "assets/logo.inline.js",
    "pdf.js",
    "app.js",
]:
    html = inline_js(html, js)

out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(html, encoding="utf-8")
print(f"Wrote: {out}")
PY
