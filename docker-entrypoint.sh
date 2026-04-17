#!/bin/sh
set -eu

# Evita archivos core.* gigantes cuando Chromium o sus subprocesos fallan.
ulimit -c 0 || true

mkdir -p "${BROWSER_TMP_ROOT:-/tmp/enarpa-browser}"
chmod 700 "${BROWSER_TMP_ROOT:-/tmp/enarpa-browser}" || true

exec "$@"
