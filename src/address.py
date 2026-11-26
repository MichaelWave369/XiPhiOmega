"""Independent XPO-003 address/ordinal codec. No state allocation."""
import re

RADIX = 20736
MAX_DEPTH = 36


def check(ok):
    if not ok:
        raise ValueError("invalid address contract")


def label(v):
    check(isinstance(v, str) and re.fullmatch(r"[a-z][a-z0-9.-]{0,63}", v))
    return v


def space(v):
    check(v in ("state", "relation"))
    return v


def integer(v, lo, hi):
    check(type(v) is int and lo <= v <= hi)
    return v


def format_address(v):
    check(isinstance(v, dict) and set(v) == {"namespace", "space", "path"})
    path = v["path"]
    check(isinstance(path, list) and 1 <= len(path) <= MAX_DEPTH)
    return "/".join(["xpo3", label(v["namespace"]), space(v["space"])]
                    + [f"{integer(d, 0, RADIX-1):06d}" for d in path])


def parse_address(s):
    check(isinstance(s, str) and len(s) <= 336)
    fields = s.split("/")
    check(4 <= len(fields) <= 3+MAX_DEPTH and fields[0] == "xpo3")
    path = []
    for f in fields[3:]:
        check(re.fullmatch(r"[0-9]{6}", f))
        path.append(integer(int(f), 0, RADIX-1))
    v = {"namespace": label(fields[1]), "space": space(fields[2]), "path": path}
    check(format_address(v) == s)
    return v


def to_ordinal(s):
    v = parse_address(s)
    n = 0
    for d in v["path"]:
        n = RADIX*n + d
    return {"namespace": v["namespace"], "space": v["space"],
            "depth": len(v["path"]), "index": str(n)}


def from_ordinal(v):
    check(isinstance(v, dict) and set(v) == {"namespace", "space", "depth", "index"})
    depth = integer(v["depth"], 1, MAX_DEPTH)
    raw = v["index"]
    check(isinstance(raw, str) and len(raw) <= 156
          and re.fullmatch(r"0|[1-9][0-9]*", raw))
    n = int(raw)
    check(n < RADIX**depth)
    path = [0]*depth
    for i in range(depth-1, -1, -1):
        n, path[i] = divmod(n, RADIX)
    return format_address({"namespace": v["namespace"], "space": v["space"], "path": path})
