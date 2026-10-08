import json, os, sys, re, shutil, subprocess, datetime, collections
ROOT = os.path.dirname(os.path.abspath(__file__))
WF = sys.argv[1]
truth = json.load(open(os.path.join(ROOT, "truth2.json"), encoding="utf-8"))
runs = os.path.join(ROOT, "runs2")
ANS = [True, True, False, False, False, True, False, True]
labels, results = {}, {}
for line in open(os.path.join(WF, "journal.jsonl"), encoding="utf-8"):
    j = json.loads(line)
    if j["type"] == "started": labels[j["agentId"]] = j["label"]
    elif j["type"] == "result": results[j["agentId"]] = j["result"]

def sh(cmd, cwd):
    return subprocess.run(cmd, cwd=cwd, shell=True, capture_output=True, text=True, timeout=120, encoding="utf-8", errors="replace").stdout

def counts(out):
    m = re.search(r"ℹ pass (\d+)", out); n = re.search(r"ℹ fail (\d+)", out)
    return (int(m.group(1)) if m else 0, int(n.group(1)) if n else 99)

def grade(task, cond, rep, r):
    d = os.path.join(runs, f"{task}-{cond}-{rep}")
    if r is None: return 0.0, {"null": True}
    if task in ("H1a", "H1b"):
        got = {os.path.basename(x["file"]).replace(".js", ""): x["hasBug"] for x in r["results"]}
        files = [k for k in truth["H1"]["bug"] if k in got or True]
        batch = {"H1a": ["s02","s06","s03","s07","s04"], "H1b": ["s09","s01","s10","s05","s08"]}[task]
        c = sum(1 for f in batch if got.get(f) == truth["H1"]["bug"][f])
        fp = sum(1 for f in batch if got.get(f) is True and not truth["H1"]["bug"][f])
        fn = sum(1 for f in batch if got.get(f) is False and truth["H1"]["bug"][f])
        return c / 5, {"fp": fp, "fn": fn}
    if task == "H2":
        same = open(os.path.join(d, "test", "calc.test.js"), encoding="utf-8").read() == open(os.path.join(ROOT, "templates2", "h2", "test", "calc.test.js"), encoding="utf-8").read()
        ps, fl = counts(sh("node --test test/calc.test.js", d))
        txt = " ".join(r.get("rootCauses") or []).lower() + (r.get("summary") or "").lower()
        a = "defaults" in txt or "merge" in txt or "spread" in txt or "override" in txt
        b = "case" in txt or "uppercase" in txt or "lowercase" in txt or "대소문자" in txt or "tolower" in txt
        return float(fl == 0 and ps == 8 and same), {"pass": ps, "intact": same, "named_both": a and b}
    if task == "H3":
        os.makedirs(os.path.join(d, "test"), exist_ok=True)
        shutil.copy(os.path.join(ROOT, "hidden2", "duration.hidden.test.js"), os.path.join(d, "test"))
        ps, fl = counts(sh("node --test test/duration.hidden.test.js", d))
        return ps / 17, {"hidden_pass": ps}
    if task == "H4":
        got = {v["n"]: v["holds"] for v in r["verdicts"]}
        c = sum(1 for i, a in enumerate(ANS, 1) if got.get(i) == a)
        return c / 8, {}
    if task == "H5":
        out = sh("node check.js", d).strip()
        try: o = json.loads(out)
        except Exception: o = {}
        exp = truth["H5"]["expected"]
        good = sum(1 for k, v in exp.items() if o.get(k) == v)
        src = open(os.path.join(d, "src", "pricing.js"), encoding="utf-8").read()
        sig = re.search(r"export function price\(\s*\{", src) is not None
        return (good / len(exp)) if sig else 0.0, {"outputs_ok": good, "sig": sig}
    return 0.0, {}

def metrics(aid):
    f = os.path.join(WF, f"agent-{aid}.jsonl")
    ts, out, inp, models, effort, tools = [], 0, 0, set(), set(), 0
    for line in open(f, encoding="utf-8"):
        j = json.loads(line)
        if j.get("timestamp"): ts.append(j["timestamp"])
        m = j.get("message") or {}
        if isinstance(m, dict) and m.get("usage"):
            u = m["usage"]; out += u.get("output_tokens", 0)
            inp += u.get("input_tokens", 0) + u.get("cache_creation_input_tokens", 0) + u.get("cache_read_input_tokens", 0)
            if m.get("model") and m["model"] != "<synthetic>": models.add(m["model"])
        if j.get("effort"): effort.add(j["effort"])
        if isinstance(m, dict) and isinstance(m.get("content"), list):
            tools += sum(1 for c in m["content"] if isinstance(c, dict) and c.get("type") == "tool_use")
    fmt = lambda s: datetime.datetime.fromisoformat(s.replace("Z", "+00:00"))
    return dict(sec=(fmt(max(ts)) - fmt(min(ts))).total_seconds() if len(ts) > 1 else 0, out=out, inp=inp, tools=tools, models=sorted(models), effort=sorted(effort))

rows = []
for aid, lab in labels.items():
    task, cond, rep = lab.split("|")
    sc, ex = grade(task, cond, rep, results.get(aid))
    rows.append(dict(task=task, cond=cond, rep=int(rep), score=sc, **ex, **metrics(aid), agent=aid))
json.dump(rows, open(os.path.join(ROOT, "rows2.json"), "w"), ensure_ascii=False, indent=1)
print(len(rows), "rows")
