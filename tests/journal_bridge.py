"""Test-only trusted fixture bridge."""
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from journal import replay


def attempt(raw, tip):
    try:
        return {"ok": True, "value": replay(raw, tip)}
    except (ValueError, TypeError, OverflowError, IndexError):
        return {"ok": False}


data = json.load(sys.stdin)
print(json.dumps([attempt(raw, tip) for raw, tip in data]))
