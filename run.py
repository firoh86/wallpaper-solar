"""
Lanzador de desarrollo:  python run.py

Equivale a "python -m wallpaper_solar" pero sin tener que instalar el paquete
ni configurar PYTHONPATH. El instalador final no usará este archivo.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))

from wallpaper_solar.main import main  # noqa: E402

if __name__ == "__main__":
    main()
