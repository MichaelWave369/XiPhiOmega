"""Independent XPO-005 replay oracle; no writes or authority."""
import hashlib
import json
import re
from fractions import Fraction

MAX_BYTES = 65536


def check(ok):
    if not ok:
        raise ValueError("invalid journal")


def canonical(v):
    return json.dumps(v, ensure_ascii=True, separators=(",", ":"), allow_nan=False)


def digest(v):
    return hashlib.sha256(canonical(v).encode("ascii")).hexdigest()


def grid(v):
    check(type(v) is int and 0 <= v <= 12)
    return v


def replay(raw, expected_tip=None):
    check(isinstance(raw, str) and len(raw) <= MAX_BYTES
          and all(32 <= ord(c) <= 126 for c in raw))
    v = json.loads(raw)
    check(canonical(v) == raw and isinstance(v, list) and len(v) == 2)
    g, events = v
    check(isinstance(g, list) and len(g) == 7)
    a, b = grid(g[5]), grid(g[6])
    check(g == ["xpo5.v1", "synthetic", "none", "xpo-id/phi/pocket-a",
                "xpo-id/phi/pocket-b", a, b])
    check(isinstance(events, list) and len(events) <= 36)
    d, state = 12, [str(a), str(b), "12"]
    tip = digest(["xpo5.genesis.v1", g])
    used = set()
    for revision, e in enumerate(events):
        check(isinstance(e, list) and len(e) == 8)
        ident, w = e[0], grid(e[2])
        check(isinstance(ident, str) and re.fullmatch(r"[a-z][a-z0-9.-]{0,63}", ident)
              and ident not in used)
        x, y = Fraction(int(state[0]), d), Fraction(int(state[1]), d)
        transfer = Fraction(w, 24)*(y-x)
        z = d*24
        nx, ny = (x+transfer)*z, (y-transfer)*z
        check(nx.denominator == ny.denominator == 1)
        check(0 <= nx <= z and 0 <= ny <= z and nx+ny == (x+y)*z)
        after = [str(nx.numerator), str(ny.numerator), str(z)]
        scar = str(int(state[1])-int(state[0])) if w == 12 else None
        body = [ident, revision, w, tip, state, after, scar]
        next_tip = digest(["xpo5.event.v1", body])
        # Canonical bytes, not Python equality (bool == int).
        check(canonical(e) == canonical(body+[next_tip]))
        used.add(ident)
        state, d, tip = after, z, next_tip
    if expected_tip is not None:
        check(isinstance(expected_tip, str) and expected_tip == tip)
    return {"revision": len(events), "state": state, "tip": tip,
            "classification": "synthetic", "authority": "none"}
