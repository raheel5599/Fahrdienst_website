#!/usr/bin/env python3
"""Preserve only server-managed project credentials when replacing deployment env."""
import os
from pathlib import Path
import re
import sys
import tempfile
def merge(previous, incoming):
    pattern = r'^\s*(?:export\s+)?(VERWALTUNG_API_URL|VERWALTUNG_PROJECT_TOKEN)\s*='
    preserved = [line for line in previous.splitlines() if re.match(pattern,line)]
    clean = [line for line in incoming.splitlines() if not re.match(pattern,line)]
    return '\n'.join(clean + preserved) + '\n'
if __name__ == '__main__':
    target, incoming = map(Path,sys.argv[1:3])
    if target.is_symlink() or incoming.is_symlink(): raise SystemExit('Symlink refused')
    content=merge(target.read_text() if target.exists() else '', incoming.read_text())
    fd,name=tempfile.mkstemp(prefix='.env-',dir=target.parent)
    try:
        os.fchmod(fd,0o600)
        with os.fdopen(fd,'w') as f: f.write(content);f.flush();os.fsync(f.fileno())
        os.replace(name,target)
    finally:
        if os.path.exists(name):os.unlink(name)
    incoming.unlink()
