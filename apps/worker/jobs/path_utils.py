from __future__ import annotations

from pathlib import Path


def display_path(path: Path, root_dir: Path) -> str:
    try:
        return str(path.relative_to(root_dir))
    except ValueError:
        return str(path)
