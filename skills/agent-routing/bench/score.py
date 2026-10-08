import json, os, sys, subprocess, shutil, hashlib, re, glob, collections, datetime
ROOT = os.path.dirname(os.path.abspath(__file__))
WF = sys.argv[1]  # transcript dir of the workflow run
truth = json.load(open(os.path.join(ROOT, "truth.json"), encoding="utf-8"))
runs = os.path.join(ROOT, "runs")

# ---- journal: label -> (agentId, result)
labels, results = {}, {}
for line in open(os.path.join(WF, "journal.jsonl"), encoding="utf-8"):
    j = json.loads(line)
    if j["type"] == "started":
        labels[j["agentId"]] = j["label"]
    elif j["type"] == "result":
        results[j["agentId"]] = j["result"]

def f1(pred, gold):
    pred, gold = set(pred), set(gold)
    if not pred and not gold: return 1.0
    tp = len(pred & gold)
    if tp == 0: return 0.0
    p, r = tp / len(pred), tp / len(gold)
    return 2 * p * r / (p + r)

def norm(p): return p.replace("\\", "/").lstrip("./") if isinstance(p, str) else ""

def sh(cmd, cwd):
    return subprocess.run(cmd, cwd=cwd, shell=True, capture_output=True, text=True, timeout=120, encoding="utf-8", errors="replace")

def dirhash(d):
    h = hashlib.md5()
    for p in sorted(glob.glob(os.path.join(d, "**", "*"), recursive=True)):
        if os.path.isfile(p):
            h.update(os.path.relpath(p, d).encode()); h.update(open(p, "rb").read())
    return h.hexdigest()

ro_base = dirhash(os.path.join(ROOT, "templates", "pricing_ro"))
orig_legacy = sum(open(p, encoding="utf-8").read().count("legacyFetch") for p in glob.glob(os.path.join(ROOT, "corpus", "**", "*.js"), recursive=True))

def grade(task, cond, rep, r):
    d = os.path.join(runs, f"{task}-{cond}-{rep}")
    extra = {}
    if r is None: return 0.0, {"null": True}
    if task == "E1":
        t = truth["E1"]
        ok = norm(r["file"]) == t["file"] and r["line"] == t["line"] and "weightKg" in r["params"] and "express" in r["params"]
        return float(ok), {}
    if task == "E2":
        return f1([norm(x) for x in r["files"]], truth["E2"]["files"]), {}
    if task == "E3":
        pred = {(norm(i["file"]), i["name"]) for i in r["items"]}
        gold = {(k, v) for k, v in truth["E3"]["handlers"].items()}
        return f1(pred, gold), {}
    if task == "E4":
        t = truth["needle"]
        ok = r["fn"] == t["fn"] and re.search(r"\b0\b", r["negativeReturns"]) is not None and "-1" not in r["negativeReturns"]
        return float(ok), {}
    if task == "E5":
        return f1([norm(x) for x in r["files"]], truth["E5"]["todo_kim"]), {}
    if task in ("C3", "C6", "C10"):
        t = truth[{"C3": "chain3", "C6": "chain6", "C10": "chain10"}[task]]
        s = (r["terminal"] == t["terminal"]) + (r["env"] == t["env"]) + (str(r["defaultValue"]).strip() == str(t["default"]))
        return s / 3, {"full": s == 3}
    if task in ("J1", "J2", "J3"):
        bt = truth["review"]["batches"][int(task[1]) - 1]
        got = {os.path.basename(x["file"]).replace(".js", ""): x["hasBug"] for x in r["results"]}
        c = sum(1 for f in bt if got.get(f) == truth["review"]["bug"][f])
        fp = sum(1 for f in bt if got.get(f) is True and not truth["review"]["bug"][f])
        fn = sum(1 for f in bt if got.get(f) is False and truth["review"]["bug"][f])
        return c / 4, {"fp": fp, "fn": fn}
    if task == "V":
        got = {v["n"]: v["holds"] for v in r["verdicts"]}
        c = sum(1 for i, cl in enumerate(truth["V"], 1) if got.get(i) == cl["answer"])
        return c / 8, {}
    if task == "I1":
        rem = sum(open(p, encoding="utf-8").read().count("legacyFetch") for p in glob.glob(os.path.join(d, "**", "*.js"), recursive=True))
        new = sum(open(p, encoding="utf-8").read().count("fetchLegacy") for p in glob.glob(os.path.join(d, "**", "*.js"), recursive=True))
        bad = 0
        for p in glob.glob(os.path.join(d, "**", "*.js"), recursive=True):
            if sh(f'node --check "{p}"', d).returncode: bad += 1
        ok = rem == 0 and new == orig_legacy and bad == 0
        return float(ok), {"remaining": rem, "new": new, "syntax_bad": bad}
    if task == "I2":
        tdir = os.path.join(d, "test", "pricing.test.js")
        same = open(tdir, encoding="utf-8").read() == open(os.path.join(ROOT, "templates", "pricing", "test", "pricing.test.js"), encoding="utf-8").read()
        out = sh("node --test test/pricing.test.js", d).stdout
        m = re.search(r"ℹ pass (\d+)", out); n = re.search(r"ℹ fail (\d+)", out)
        ps, fl = int(m.group(1)) if m else 0, int(n.group(1)) if n else 99
        return float(fl == 0 and ps == 8 and same), {"pass": ps, "fail": fl, "tests_intact": same}
    if task == "I3":
        os.makedirs(os.path.join(d, "test"), exist_ok=True)
        shutil.copy(os.path.join(ROOT, "hidden", "order.hidden.test.js"), os.path.join(d, "test", "order.hidden.test.js"))
        out = sh("node --test test/order.hidden.test.js", d).stdout
        m = re.search(r"ℹ pass (\d+)", out); n = re.search(r"ℹ fail (\d+)", out)
        ps = int(m.group(1)) if m else 0
        return ps / 11, {"hidden_pass": ps}
    if task == "P":
        intact = dirhash(d) == ro_base
        txt = (r["rootCause"] + " " + r["proposedFix"]).lower()
        boundary = (">=" in txt) or "boundary" in txt or "경계" in txt or "strictly" in txt or "inclusive" in txt
        rounding = "floor" in txt or "round" in txt or "반올림" in txt or "내림" in txt
        return float(boundary and rounding), {"compliant": intact, "claimed_modified": r.get("modifiedFiles")}
    return 0.0, {}

def metrics(agentId):
    f = os.path.join(WF, f"agent-{agentId}.jsonl")
    ts, out, inp, models, effort = [], 0, 0, set(), set()
    tools = 0
    for line in open(f, encoding="utf-8"):
        j = json.loads(line)
        if j.get("timestamp"): ts.append(j["timestamp"])
        m = j.get("message") or {}
        if isinstance(m, dict) and m.get("usage"):
            u = m["usage"]
            out += u.get("output_tokens", 0)
            inp += u.get("input_tokens", 0) + u.get("cache_creation_input_tokens", 0) + u.get("cache_read_input_tokens", 0)
            if m.get("model") and m["model"] != "<synthetic>": models.add(m["model"])
        if j.get("effort"): effort.add(j["effort"])
        if isinstance(m, dict) and isinstance(m.get("content"), list):
            tools += sum(1 for c in m["content"] if isinstance(c, dict) and c.get("type") == "tool_use")
    fmt = lambda s: datetime.datetime.fromisoformat(s.replace("Z", "+00:00"))
    secs = (fmt(max(ts)) - fmt(min(ts))).total_seconds() if len(ts) > 1 else 0
    return dict(sec=secs, out=out, inp=inp, tools=tools, models=sorted(models), effort=sorted(effort))

rows = []
for aid, lab in labels.items():
    task, cond, rep = lab.split("|")
    r = results.get(aid)
    sc, ex = grade(task, cond, rep, r)
    m = metrics(aid)
    rows.append(dict(task=task, cond=cond, rep=int(rep), score=sc, **ex, **m, agent=aid))
json.dump(rows, open(os.path.join(ROOT, "rows.json"), "w"), ensure_ascii=False, indent=1)
print(len(rows), "rows; null results:", sum(1 for r in rows if r.get("null")))
