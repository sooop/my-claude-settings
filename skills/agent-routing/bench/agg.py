import json, collections, statistics as st
rows = json.load(open('rows.json', encoding='utf-8'))
C = ['h4','hL','hM','hH','sM','sH']
tasks = sorted({r['task'] for r in rows}, key=lambda t:(t[0],len(t),t))
def avg(xs): return sum(xs)/len(xs) if xs else float('nan')
print("== model check ==")
mm = collections.defaultdict(set)
for r in rows: mm[r['cond']].add((tuple(r['models']), tuple(r['effort'])))
for c in C: print(c, mm[c])
print("\n== score (mean of 2 reps) by task x cond ==")
print('task  '+' '.join(f'{c:>6}' for c in C))
for t in tasks:
    print(f'{t:5} '+' '.join(f"{avg([r['score'] for r in rows if r['task']==t and r['cond']==c]):6.2f}" for c in C))
print('ALL   '+' '.join(f"{avg([r['score'] for r in rows if r['cond']==c]):6.2f}" for c in C))
for label, f in [('sec', 'sec'), ('out_tokens','out'), ('tool_calls','tools')]:
    print(f"\n== {label} (mean) ==")
    print('task  '+' '.join(f'{c:>6}' for c in C))
    for t in tasks:
        print(f'{t:5} '+' '.join(f"{avg([r[f] for r in rows if r['task']==t and r['cond']==c]):6.0f}" for c in C))
    print('ALL   '+' '.join(f"{avg([r[f] for r in rows if r['cond']==c]):6.0f}" for c in C))
print("\n== extras ==")
for r in rows:
    if r['task'][0] in 'JPI' and r['score']<1: print({k:r[k] for k in r if k not in('agent','models','effort','out','inp')})
