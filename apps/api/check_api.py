import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from apps.api.app.config import get_settings
from apps.api.app.main import app


def main() -> None:
    settings = get_settings()
    routes = sorted(route.path for route in app.routes)
    print(f"{settings.service_name} {settings.service_version}")
    print("routes=" + ",".join(routes))


if __name__ == "__main__":
    main()
