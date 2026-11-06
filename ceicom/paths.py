import os
import sys
from pathlib import Path


def app_home():
    """CEICOM_HOME permite usar un disco escribible cuando el USB es de solo lectura."""
    default = Path(sys.executable).parent if getattr(sys, 'frozen', False) else Path(__file__).resolve().parent.parent
    root = Path(os.environ.get('CEICOM_HOME', default)).resolve()
    if '--demo' in sys.argv:
        root = root / 'demo'
    (root / 'datos').mkdir(parents=True, exist_ok=True)
    (root / 'Informes').mkdir(parents=True, exist_ok=True)
    return root
