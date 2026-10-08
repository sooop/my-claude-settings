import json
rows=json.load(open('rows2.json',encoding='utf-8'))
C=['hL','hM','sM','sH','oH']
tasks=sorted({r['task'] for r in rows})
av=lambda x:sum(x)/len(x) if x else float('nan')
for name,f,fmt in [('SCORE','score','{:6.2f}'),('SEC','sec','{:6.0f}'),('OUT_TOK','out','{:6.0f}'),('TOOLS','tools','{:6.0f}')]:
    print('\n==',name); print('task  '+' '.join(f'{c:>6}' for c in C))
    for t in tasks: print(f'{t:5} '+' '.join(fmt.format(av([r[f] for r in rows if r['task']==t and r['cond']==c])) for c in C))
    print('ALL   '+' '.join(fmt.format(av([r[f] for r in rows if r['cond']==c])) for c in C))
print('\nmodels:',{c:{(tuple(r['models']),tuple(r['effort'])) for r in rows if r['cond']==c} for c in C})
print('\nper-rep scores (task cond: s1 s2 s3)')
for t in tasks:
    for c in C:
        print(t,c,[round(r['score'],2) for r in sorted(rows,key=lambda r:r['rep']) if r['task']==t and r['cond']==c], [ (r.get('fp'),r.get('fn')) for r in sorted(rows,key=lambda r:r['rep']) if r['task']==t and r['cond']==c and t.startswith('H1')])
