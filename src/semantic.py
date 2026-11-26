"""Independent finite semantic reference; synthetic dialects, no execution."""
from fractions import Fraction
import re

REGISTRY = {
    ("xi.demo.v1", "∴"): "length", ("xi.demo.v1", "⋈"): "duration",
    ("xi.demo.v1", "⊚"): "resource", ("phi.demo.v1", "∴"): "duration",
    ("phi.demo.v1", "extent"): "length", ("phi.demo.v1", "budget"): "resource",
    ("omega.demo.v1", "span"): "length", ("omega.demo.v1", "period"): "duration",
    ("omega.demo.v1", "∴"): "resource",
}
UNITS = {("length", "m"): 1, ("length", "cm"): 100, ("length", "mm"): 1000,
         ("duration", "s"): 1, ("duration", "ms"): 1000, ("resource", "1"): 1}


def check(ok):
    if not ok:
        raise ValueError("semantic contract refused")


def fields(v, keys):
    check(isinstance(v, dict) and set(v) == set(keys.split(",")))


def binding(dialect, symbol, unit):
    check(all(isinstance(x, str) for x in (dialect, symbol, unit)))
    concept = REGISTRY.get((dialect, symbol))
    scale = UNITS.get((concept, unit))
    check(concept is not None and scale is not None)
    return concept, scale


def rational(v):
    a, b = str(v.numerator), str(v.denominator)
    check(len(a.lstrip("-")) <= 36 and len(b) <= 36)
    return a + "/" + b


def parse_rational(s):
    check(isinstance(s, str) and len(s) <= 74 and
          re.fullmatch(r"-?(0|[1-9][0-9]{0,35})/[1-9][0-9]{0,35}", s))
    n, d = map(int, s.split("/"))
    v = Fraction(n, d)
    check(rational(v) == s)
    return v


def translate(record, target):
    fields(record, "dialect,status,symbol,unit,value")
    fields(target, "dialect,symbol,unit")
    src, scale = binding(record["dialect"], record["symbol"], record["unit"])
    dst, out_scale = binding(target["dialect"], target["symbol"], target["unit"])
    check(src == dst)
    status, value = record["status"], record["value"]
    check(status in ("known", "unknown"))
    if status == "known":
        value = rational(parse_rational(value)*out_scale/scale)
    else:
        check(value is None)
    return {**target, "status": status, "value": value}
