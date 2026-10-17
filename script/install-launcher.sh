#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# The Dock app and project shortcuts use this entrypoint. Link the maintained
# script instead of copying it, so new launches always load the current plugin.
python3 - "$ROOT_DIR/script/dsh-project" <<'PY'
from pathlib import Path
import os
import shutil
import time
import uuid
import sys

source = Path(sys.argv[1]).resolve(strict=True)
if not os.access(source, os.X_OK):
    raise SystemExit(f'Launcher source is not executable: {source}')
target = Path.home() / '.local/bin/dsh-project'
target.parent.mkdir(parents=True, exist_ok=True)
if target.is_symlink() and target.resolve() == source:
    print(f'Launcher already current: {target} -> {source}')
    raise SystemExit(0)
if target.exists() or target.is_symlink():
    if target.is_dir():
        raise SystemExit(f'Refusing to replace a directory: {target}')
    backups = Path.home() / '.local/share/deepseek-harness/launcher-backups'
    backups.mkdir(parents=True, exist_ok=True)
    backup = backups / f'dsh-project-{time.time_ns()}'
    shutil.copy2(target, backup, follow_symlinks=False)
    print(f'Previous launcher preserved: {backup}')
temporary = target.with_name(f'.dsh-project-{uuid.uuid4().hex}')
try:
    temporary.symlink_to(source)
    os.replace(temporary, target)
finally:
    temporary.unlink(missing_ok=True)
print(f'Launcher installed: {target} -> {source}')
PY
