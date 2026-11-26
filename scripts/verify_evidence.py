"""Independent XPO-009 offline evidence verification using Python and OpenSSL 3."""
import base64
import hashlib
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from capsule import decode
from interop import verify_return
from journal import replay, canonical

MAX_EVIDENCE = 512 * 1024
MAX_TRUST = 8192


def check(ok):
    if not ok:
        raise ValueError("evidence refused")


def keys(v, names):
    check(isinstance(v, dict) and set(v) == set(names.split(",")))


def no_duplicates(pairs):
    out = {}
    for k, v in pairs:
        check(k not in out)
        out[k] = v
    return out


def load(path, limit):
    with open(path, "rb") as f:
        raw = f.read(limit+1)
    check(len(raw) <= limit)
    return json.loads(raw.decode("utf-8"), object_pairs_hook=no_duplicates)


def hex_bytes(s, limit, exact=None):
    check(isinstance(s, str) and 0 < len(s) <= limit*2 and len(s)%2 == 0
          and re.fullmatch(r"[0-9a-f]+", s))
    v = bytes.fromhex(s)
    check(exact is None or len(v) == exact)
    return v


def sha(b):
    return hashlib.sha256(b).hexdigest()


def int_range(v, low, high):
    check(type(v) is int and low <= v <= high)


def verify_package(trust, evidence):
    keys(trust, "schema,gate,issuer,publicKey,genesis,weights,reviewTime")
    keys(evidence, "schema,classification,rows,journal")
    check(trust["schema"] == "xpo9.trust.v1" and evidence["schema"] == "xpo9.evidence.v1"
          and evidence["classification"] == "synthetic")
    for label in [trust["gate"], trust["issuer"]]:
        check(isinstance(label, str) and re.fullmatch(r"[a-z][a-z0-9.-]{0,63}", label))
    pem = trust["publicKey"]
    check(isinstance(pem, str) and len(pem) <= 256)
    match = re.fullmatch(r"-----BEGIN PUBLIC KEY-----\n([A-Za-z0-9+/=]+)\n-----END PUBLIC KEY-----\n", pem)
    check(match is not None)
    der = base64.b64decode(match.group(1), validate=True)
    # Exact RFC 8410 Ed25519 SPKI prefix; no algorithm substitution.
    check(len(der) == 44 and der[:12] == bytes.fromhex("302a300506032b6570032100"))
    check(base64.b64encode(der).decode("ascii") == match.group(1))
    weights = trust["weights"]
    check(isinstance(weights, list) and 1 <= len(weights) <= 36)
    for w in weights:
        int_range(w, 0, 12)
    now = trust["reviewTime"]
    int_range(now, 0, 2**53-1)
    prior = trust["genesis"]
    check(replay(prior)["revision"] == 0)
    journal = evidence["journal"]
    final = replay(journal)
    g, events = json.loads(journal)
    check(canonical([g, []]) == prior)
    rows = evidence["rows"]
    check(isinstance(rows, list) and len(rows) == len(weights) == len(events))
    nonces = set()
    with tempfile.TemporaryDirectory(prefix="xpo9-verify-") as tmp:
        key, msg, sig = [Path(tmp)/n for n in ("public.pem", "message", "signature")]
        key.write_text(pem, encoding="ascii")
        def verify(message, signature):
            msg.write_bytes(message)
            sig.write_bytes(signature)
            p = subprocess.run(["openssl", "pkeyutl", "-verify", "-pubin", "-inkey", str(key),
                                "-rawin", "-in", str(msg), "-sigfile", str(sig)],
                               capture_output=True, timeout=5)
            check(p.returncode == 0)
        for i, (row, weight) in enumerate(zip(rows, weights, strict=True)):
            keys(row, "proposal,permit,approval,response")
            proposal = hex_bytes(row["proposal"], 16600)
            response = hex_bytes(row["response"], 16600)
            permit = row["permit"]
            check(isinstance(permit, str) and len(permit) <= 2048 and permit.isascii())
            envelope = json.loads(permit)
            check(canonical(envelope) == permit and isinstance(envelope, list) and len(envelope) == 2)
            body, signature = envelope
            check(isinstance(body, list) and len(body) == 11)
            current = replay(prior)
            c = decode(proposal)
            check(len(c["atoms"]) == 11)
            nonce = c["atoms"][10]
            hex_bytes(nonce, 16, 16)
            check(nonce not in nonces)
            nonces.add(nonce)
            issued, expires = body[9:]
            int_range(issued, 0, 2**53-1)
            int_range(expires, 0, 2**53-1)
            check(issued <= now < expires and expires-issued <= 60)
            expected = ["xpo6.permit.v1", "xpo6.synthetic-journal", trust["gate"], trust["issuer"],
                        nonce, i, current["tip"], "exchange.synthetic", weight, issued, expires]
            check(canonical(body) == canonical(expected))
            verify(canonical(body).encode("ascii"), hex_bytes(signature, 64, 64))
            approval = ["xpo9.approval.v1", sha(proposal), sha(permit.encode("ascii"))]
            verify(canonical(approval).encode("ascii"), hex_bytes(row["approval"], 64, 64))
            nxt = canonical([g, events[:i+1]])
            verified = verify_return(proposal, response, prior, nxt)
            # Bind the independently verified transition to the signed weight.
            check(events[i][2] == weight and events[i][0] == "permit."+nonce)
            check(verified["revision"] == i+1)
            prior = nxt
    check(prior == journal)
    return {"schema": "xpo9.verification.v1", "classification": "synthetic",
            "verifiedTransitions": len(rows), "permitSignatures": len(rows),
            "proposalApprovalSignatures": len(rows), "finalTip": final["tip"],
            "finalState": final["state"], "externalExecutionProven": False,
            "trust": "caller-supplied-fixture-key-and-policy"}


if __name__ == "__main__":
    try:
        check(len(sys.argv) == 3)
        print(json.dumps(verify_package(load(sys.argv[1], MAX_TRUST),
                                        load(sys.argv[2], MAX_EVIDENCE)), sort_keys=True))
    except (ValueError, TypeError, KeyError, IndexError, OSError, subprocess.SubprocessError,
            OverflowError, RecursionError):
        print("evidence refused", file=sys.stderr)
        sys.exit(1)
