"""Test-only trusted-fixture bridge."""
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from address import parse_address, format_address, to_ordinal, from_ordinal


def attempt(fn, v):
    try:
        return {"ok": True, "value": fn(v)}
    except (ValueError, TypeError, OverflowError):
        return {"ok": False}


def both(s):
    v = parse_address(s)
    ordinal = to_ordinal(s)
    if format_address(v) != s or from_ordinal(ordinal) != s:
        raise ValueError("roundtrip")
    return {"address": s, "ordinal": ordinal}


batch = json.load(sys.stdin)
print(json.dumps({
    "valid": [attempt(both, s) for s in batch["valid"]],
    "badAddresses": [attempt(parse_address, s) for s in batch["badAddresses"]],
    "badOrdinals": [attempt(from_ordinal, v) for v in batch["badOrdinals"]]
}))
