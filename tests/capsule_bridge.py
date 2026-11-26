"""Test-only batch bridge, not a service or untrusted-input CLI."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from capsule import encode, decode


def attempt(fn, value):
    try:
        return {"ok": True, "value": fn(value)}
    except (ValueError, TypeError, OverflowError):
        return {"ok": False}


batch = json.load(sys.stdin)
print(json.dumps({
    "encoded": [attempt(lambda v: encode(v).hex(), v) for v in batch["encode"]],
    "decoded": [attempt(lambda v: decode(bytes.fromhex(v)), v) for v in batch["decode"]]
}, ensure_ascii=True))
