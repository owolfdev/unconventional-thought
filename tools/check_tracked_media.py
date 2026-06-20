#!/usr/bin/env python3
"""Report tracked files that should be local-only media binaries."""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
MEDIA_PREFIX = "media_tool/public/media/"

MEDIA_ALLOWED_SUFFIX = {".json"}
MEDIA_ALLOWED_NAMES = {".gitkeep", "README.md"}

# Other paths / extensions that should never be in git
EXTRA_PATTERNS = [
    re.compile(r"^episodes/.+/audio/vo/.+\.(mp3|mp4|wav|m4a|png)$", re.I),
    re.compile(r"^episodes/.+/graphics/.+\.af$", re.I),
    re.compile(r"^episodes/.+/media/.+\.af$", re.I),
    re.compile(r"^episodes/.+/graphics/thumbnail\.jpg$", re.I),
    re.compile(r"^remotion/out/", re.I),
    re.compile(r"^media_tool/public/tmp/", re.I),
    re.compile(r"^vo_source/", re.I),
]


def git_ls_files() -> list[str]:
    out = subprocess.check_output(
        ["git", "-C", str(REPO), "ls-files"],
        text=True,
    )
    return [line.strip() for line in out.splitlines() if line.strip()]


def is_media_violation(path: str) -> bool:
    if Path(path).name in MEDIA_ALLOWED_NAMES:
        return False

    if path.startswith(MEDIA_PREFIX):
        if Path(path).suffix.lower() in MEDIA_ALLOWED_SUFFIX:
            return False
        return True

    return any(p.search(path) for p in EXTRA_PATTERNS)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--fix",
        action="store_true",
        help="Run git rm --cached on violating paths (files stay on disk)",
    )
    args = parser.parse_args()

    tracked = git_ls_files()
    violations = sorted(p for p in tracked if is_media_violation(p))

    if not violations:
        print("OK — no tracked media binaries.")
        return 0

    print(f"Found {len(violations)} tracked file(s) that should be local-only:\n")
    for path in violations:
        print(f"  {path}")

    if not args.fix:
        print("\nRun with --fix to untrack (git rm --cached). Files remain on disk.")
        return 1

    subprocess.run(
        ["git", "-C", str(REPO), "rm", "--cached", "--", *violations],
        check=True,
    )
    print(f"\nUntracked {len(violations)} path(s) from git index. Review with git status.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
