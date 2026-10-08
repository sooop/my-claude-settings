import json, os, sys
ROOT = os.path.dirname(os.path.abspath(__file__))
BASE = "C:/Users/sooop/.claude/projects/C--Users-sooop--claude/d1907dd3-0a3f-44ff-93b9-e7ee0b9b3b07/subagents/workflows/"
# $/MTok: (input, output, cache_write_5m, cache_read)  — from platform.claude.com pricing page (fetched 2026-10-08)
P = {
    "claude-haiku-5-5": (0.10, 0.50, 0.125, 0.01),
    "claude-haiku-4-5-20251001": (1.0, 5.0, 1.25, 0.10),
    "claude-sonnet-5-5": (2.0, 10.0, 2.5, 0.10),
    "claude-opus-5-5": (4.0, 20.0, 5.0, 0.20),
}
def cost_of(wf, aid):
    f = os.path.join(BASE, wf, f"agent-{aid}.jsonl")
    inp = out = cw = cr = 0; model = None
    seen = set()
    for line in open(f, encoding="utf-8"):
        j = json.loads(line)
        m = j.get("message") or {}
        if not (isinstance(m, dict) and m.get("usage")): continue
        mid = m.get("id") or j.get("uuid")
        if mid in seen: continue  # streamed duplicates of one message
        seen.add(mid)
        u = m["usage"]; model = m.get("model") if m.get("model") != "<synthetic>" else model
        inp += u.get("input_tokens", 0); out += u.get("output_tokens", 0)
        cw += u.get("cache_creation_input_tokens", 0); cr += u.get("cache_read_input_tokens", 0)
    p = P[model]
    usd = (inp * p[0] + out * p[1] + cw * p[2] + cr * p[3]) / 1e6
    return usd, dict(inp=inp, out=out, cw=cw, cr=cr, model=model)
if __name__ == "__main__":
    for rowsf, wf in [("rows.json", "wf_d7811f59-fc0"), ("rows2.json", "wf_b1d68300-fce"), ("rows3.json", sys.argv[1] if len(sys.argv) > 1 else None)]:
        p = os.path.join(ROOT, rowsf)
        if not wf or not os.path.exists(p): continue
        rows = json.load(open(p, encoding="utf-8"))
        for r in rows:
            r["usd"], r["tok"] = cost_of(wf, r["agent"])
        json.dump(rows, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(rowsf, len(rows), "costed")
