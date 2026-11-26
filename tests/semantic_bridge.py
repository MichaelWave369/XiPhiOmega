"""Test-only local fixture bridge."""
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from semantic import translate


def attempt(record, target):
    try:
        return {"ok": True, "value": translate(record, target)}
    except (ValueError, TypeError, OverflowError):
        return {"ok": False}


data = json.load(sys.stdin)
print(json.dumps({
    "valid": [attempt(v["record"], v["target"]) for v in data["valid"]],
    "bad": [attempt(a, b) for a, b in data["bad"]]
}))
