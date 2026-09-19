#!/usr/bin/env bash
# Prepare a headless Chromium for screenshots (scripts/shoot.mjs).
#
# Why this exists: playwright's own browser download is blocked in this
# environment, and the Chromium that @sparticuz/chromium ships needs libnss3 /
# libnspr4, which the image does not include and we cannot apt-get. Chromium
# never touches NSS while rendering local pages, so we generate stub libraries
# with gcc purely to satisfy the dynamic linker.
#
# Usage:  bash scripts/prepare-browser.sh
set -euo pipefail

STUB_DIR="${STUB_DIR:-/tmp/nssstub}"
mkdir -p "$STUB_DIR"

echo "==> extracting chromium from @sparticuz/chromium"
EXE=$(node --input-type=module -e "import c from '@sparticuz/chromium'; console.log(await c.executablePath())")
echo "    $EXE"

echo "==> generating NSS/NSPR symbol stubs"
python3 - "$EXE" "$STUB_DIR" <<'PY'
import subprocess, collections, re, sys, os

exe, out = sys.argv[1], sys.argv[2]
nm = subprocess.run(["nm", "-D", "--undefined-only", "--with-symbol-versions", exe],
                    capture_output=True, text=True).stdout

pairs = []
for line in nm.splitlines():
    parts = line.strip().split()
    if not parts:
        continue
    m = re.match(r'^([A-Za-z_][A-Za-z0-9_]*)(?:@@?([A-Za-z0-9_.]+))?$', parts[-1])
    if not m:
        continue
    name, ver = m.group(1), m.group(2)
    # everything libnss3/libnspr4/libnssutil3 are expected to provide
    if re.match(r'^(NSS|PK11|SSL|CERT|SECMOD|SECITEM|SECOid|SECU|PORT|PR_|PL_|SGN|VFY|HASH|FC_|CK_|NSSUTIL|BLAPI)', name):
        pairs.append((name, ver))

byver = collections.defaultdict(set)
for name, ver in pairs:
    if ver:
        byver[ver].add(name)

with open(os.path.join(out, "stub.c"), "w") as f:
    f.write("/* generated: see scripts/prepare-browser.sh */\n")
    for name, _ in pairs:
        f.write(f"void *{name}(void) {{ return 0; }}\n")

with open(os.path.join(out, "stub.map"), "w") as f:
    for ver, syms in sorted(byver.items()):
        f.write(f"{ver} {{\n  global:\n")
        for s in sorted(syms):
            f.write(f"    {s};\n")
        f.write("};\n")

print(f"    {len(pairs)} symbols across {len(byver)} version nodes")
PY

echo "==> compiling stub libraries"
for lib in libnss3.so libnspr4.so libnssutil3.so; do
  gcc -shared -fPIC -o "$STUB_DIR/$lib" "$STUB_DIR/stub.c" -Wl,--version-script="$STUB_DIR/stub.map"
done
ls -1 "$STUB_DIR"/*.so

echo
echo "ready. run screenshots with:"
echo "  LD_LIBRARY_PATH=$STUB_DIR node scripts/shoot.mjs"
