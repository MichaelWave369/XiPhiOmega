"""Trusted local test bridge; not a network service."""
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from interop import propose, verify_return

def attempt(task):
    try:
        if task["mode"] == "propose":
            return {"ok": True, "value": propose(task["prior"], task["weight"], task["nonce"]).hex()}
        if task["mode"] == "verify":
            return {"ok": True, "value": verify_return(bytes.fromhex(task["proposal"]),
                    bytes.fromhex(task["response"]), task["prior"], task["journal"])}
        raise ValueError("unknown mode")
    except (ValueError, TypeError, OverflowError, IndexError):
        return {"ok": False}

print(json.dumps([attempt(task) for task in json.load(sys.stdin)]))
