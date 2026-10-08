import json, re
WF="C:/Users/sooop/.claude/projects/C--Users-sooop--claude/d1907dd3-0a3f-44ff-93b9-e7ee0b9b3b07/subagents/workflows/wf_d7811f59-fc0/journal.jsonl"
truth=json.load(open('truth.json',encoding='utf-8'))
res={}
for l in open(WF,encoding='utf-8'):
    j=json.loads(l)
    if j['type']=='result': res[j['agentId']]=j['result']
rows=json.load(open('rows.json',encoding='utf-8'))
for r in rows:
    t=r['task']; x=res.get(r['agent'])
    if t=='E4':
        txt=json.dumps(x,ensure_ascii=False)
        ok=truth['needle']['fn'] in x['fn'] and re.search(r'(?<![\d.-])0(?![\d.])',x['negativeReturns']) is not None and '-1' not in x['negativeReturns']
        r['strict']=r['score']; r['score']=float(ok)
    elif t in('C3','C6','C10'):
        g=truth[{'C3':'chain3','C6':'chain6','C10':'chain10'}[t]]
        txt=json.dumps(x,ensure_ascii=False)
        s=(re.search(r'\b%s\b'%g['terminal'],txt) is not None)+(g['env'] in txt)+(re.search(r'(?<!\d)%s(?!\d)'%g['default'],txt) is not None)
        r['strict']=r['score']; r['score']=s/3
json.dump(rows,open('rows.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)
