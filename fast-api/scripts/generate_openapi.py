import json
import os
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))

os.environ.setdefault("DATABASE_URL", "postgres://example")
os.environ.setdefault("EMBEDDING_API_KEY", "dummy")
os.environ.setdefault("LOGFIRE_IGNORE_NO_CONFIG", "1")

from app.main import app  # noqa: E402


def main() -> None:
    output_path = ROOT_DIR / "openapi.json"
    output_path.write_text(json.dumps(app.openapi(), indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
