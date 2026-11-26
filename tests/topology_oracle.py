"""Independent node-based diffusion oracle for trusted test fixtures."""
import json
import math
import sys

data = json.load(sys.stdin)
count = 0
max_error = 0.0
for graph in data["fixtures"]:
    adj = [[] for _ in range(144)]
    for a, b in graph["edges"]:
        assert 0 <= a < b < 144
        adj[a].append(b)
        adj[b].append(a)
    assert len(graph["edges"]) == 288
    assert all(len(x) == len(set(x)) == 4 for x in adj)
    seen = {0}
    stack = [0]
    while stack:
        for j in adj[stack.pop()]:
            if j not in seen:
                seen.add(j)
                stack.append(j)
    assert len(seen) == 144
    for task, expected in zip(data["holdout"], graph["outcomes"], strict=True):
        x = task["x"][:]
        total = math.fsum(x)
        for _ in range(36):
            x = [0.5*x[i] + 0.125*math.fsum(x[j] for j in adj[i]) for i in range(144)]
            assert abs(math.fsum(x)-total) < 1e-10
            assert all(0 <= v <= 1 for v in x)
        error = max(abs(a-b) for a,b in zip(x, expected, strict=True))
        assert error < 1e-12
        max_error = max(max_error, error)
        count += 1
print(json.dumps({"pythonCases": count, "maxStateError": max_error}))
