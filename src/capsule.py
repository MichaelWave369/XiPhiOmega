"""Independent XPO-002 wire implementation. Transport only."""
import hashlib
import hmac
import re
import struct

MAGIC = b"XPO2"
MAX, LIMIT, COUNT = 16600, 1024, 16


def check(ok):
    if not ok:
        raise ValueError("invalid capsule")


def identifier(value):
    check(isinstance(value, str) and re.fullmatch(r"[a-z][a-z0-9.-]{0,63}", value))
    return value


def field(value, limit):
    check(isinstance(value, str) and len(value) <= limit)
    raw = value.encode("utf-8", errors="strict")
    check(len(raw) <= limit)
    return struct.pack(">H", len(raw)) + raw


def encode(value):
    check(isinstance(value, dict) and set(value) == {"namespace", "operation", "atoms"})
    atoms = value["atoms"]
    check(isinstance(atoms, list) and len(atoms) <= COUNT)
    body = (MAGIC + field(identifier(value["namespace"]), 64)
            + field(identifier(value["operation"]), 64) + bytes([len(atoms)])
            + b"".join(field(atom, LIMIT) for atom in atoms))
    check(len(body) + 32 <= MAX)
    return body + hashlib.sha256(body).digest()


def decode(packet):
    check(isinstance(packet, bytes) and 43 <= len(packet) <= MAX)
    body, witness = packet[:-32], packet[-32:]
    check(hmac.compare_digest(hashlib.sha256(body).digest(), witness)
          and body[:4] == MAGIC)
    pos = 4

    def read(limit):
        nonlocal pos
        check(pos + 2 <= len(body))
        n = struct.unpack_from(">H", body, pos)[0]
        pos += 2
        check(n <= limit and pos + n <= len(body))
        value = body[pos:pos+n].decode("utf-8", errors="strict")
        pos += n
        return value

    namespace, operation = identifier(read(64)), identifier(read(64))
    check(pos < len(body))
    count = body[pos]
    pos += 1
    check(count <= COUNT)
    atoms = [read(LIMIT) for _ in range(count)]
    check(pos == len(body))
    value = {"namespace": namespace, "operation": operation, "atoms": atoms}
    check(encode(value) == packet)
    return value
