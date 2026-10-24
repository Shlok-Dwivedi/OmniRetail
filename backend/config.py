"""Filesystem-independent application configuration."""

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = Path(os.environ.get("OMNIRETAIL_DATA_DIR", ROOT / "data")).resolve()
WORKSPACE = DATA_DIR / "workspace"
MAX_UPLOAD_BYTES = 40 * 1024 * 1024
FRONTEND_DIST = ROOT / "frontend" / "dist"
