"""Independent proposal producer and result checker for the synthetic XPO-008 fixture."""
import hashlib
import json
import re
from fractions import Fraction
from capsule import encode, decode
from address import parse_address
from semantic import translate
from journal import replay

A, B = "xpo-id/phi/pocket-a", "xpo-id/phi/pocket-b"
LA, LB = "xpo3/phi/state/000144/000000", "xpo3/phi/state/000144/000001"


def check(ok):
    if not ok:
        raise ValueError("interop refused")


def propose(prior, weight, nonce):
    r = replay(prior)
    check(type(weight) is int and 0 <= weight <= 12 and r["revision"] < 36)
    check(isinstance(nonce, str) and re.fullmatch(r"[0-9a-f]{32}", nonce))
    v = Fraction(weight, 12)
    return encode({"namespace": "xi.demo.v1", "operation": "exchange.propose.v1",
                   "atoms": [A, LA, B, LB, "⊚", "1", "known",
                             f"{v.numerator}/{v.denominator}", str(r["revision"]),
                             r["tip"], nonce]})


def verify_return(proposal, response, prior, journal):
    c = decode(proposal)
    check(c["namespace"] == "xi.demo.v1" and c["operation"] == "exchange.propose.v1"
          and len(c["atoms"]) == 11)
    a, la, b, lb, symbol, unit, status, value, rev, tip, nonce = c["atoms"]
    check((a, la, b, lb) == (A, LA, B, LB))
    parse_address(la)
    parse_address(lb)
    check(status == "known" and re.fullmatch(r"[0-9a-f]{32}", nonce))
    t = translate({"dialect": c["namespace"], "symbol": symbol, "unit": unit,
                   "status": status, "value": value},
                  {"dialect": "omega.demo.v1", "symbol": "∴", "unit": "1"})
    w = Fraction(t["value"]) * 12
    check(w.denominator == 1 and 0 <= w <= 12)
    w = int(w)
    before = replay(prior)
    check(rev == str(before["revision"]) and tip == before["tip"])
    after = replay(journal)
    check(after["revision"] == before["revision"] + 1)
    g0, e0 = json.loads(prior)
    g1, e1 = json.loads(journal)
    check(g0 == g1 and e1[:-1] == e0)
    last = e1[-1]
    check(last[:4] == ["permit." + nonce, before["revision"], w, before["tip"]])
    x, y, d = map(int, before["state"])
    delta = Fraction(w, 24) * (Fraction(y, d) - Fraction(x, d))
    z = d * 24
    aa, bb = (Fraction(x, d) + delta)*z, (Fraction(y, d)-delta)*z
    check(aa.denominator == bb.denominator == 1)
    check(after["state"] == [str(aa.numerator), str(bb.numerator), str(z)])
    r = decode(response)
    check(r == {"namespace": "omega.demo.v1", "operation": "exchange.result.v1",
                "atoms": [hashlib.sha256(proposal).hexdigest(), nonce, A, LA, B, LB,
                          before["tip"], after["tip"], str(after["revision"]),
                          *after["state"], "synthetic", "local-fixture-permit"]})
    return {"revision": after["revision"], "tip": after["tip"], "state": after["state"],
            "mathematics": "verified", "signature": "not-independently-verified"}
