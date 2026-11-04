"""Independent P8 E4 recount. Shares no code with eval/: reads the frozen life script and the run's archive.sqlite only.
Also rebuilds its own FTS5 (tokenizer re-implemented from P8 §3.2) as of each check and verifies rank_seqs, terms, dropped, total."""
import sys, os, json, sqlite3, unicodedata, hashlib, datetime, math
CJK_RANGES = [(0x2E80, 0x2FDF), (0x3005, 0x3007), (0x3021, 0x3029), (0x3038, 0x303B), (0x3041, 0x3096), (0x309D, 0x309F), (0x30A1, 0x30FA), (0x30FD, 0x30FF),
              (0x3131, 0x318E), (0x31F0, 0x31FF), (0x3400, 0x4DBF), (0x4E00, 0x9FFF), (0xA960, 0xA97F), (0xAC00, 0xD7A3), (0xD7B0, 0xD7FF), (0x1100, 0x11FF),
              (0xF900, 0xFAFF), (0x20000, 0x2FA1F)]
def is_cjk(ch): o = ord(ch); return any(a <= o <= b for a, b in CJK_RANGES)
def is_word(ch): return unicodedata.category(ch)[0] in 'LNM'
def tokens(text, query=False):
    out, run, kind = [], [], 0
    def flush():
        if kind == 1:
            if not query or len(run) == 1: out.extend(run)
            out.extend(run[i - 1] + run[i] for i in range(1, len(run)))
        elif kind == 2: out.append(''.join(run))
    for ch in unicodedata.normalize('NFKC', text).lower():
        k = 1 if is_cjk(ch) else 2 if is_word(ch) else 0
        if k != kind or not k: flush(); run = []; kind = k
        if k: run.append(ch)
    flush()
    if query:
        seen = []; [seen.append(t) for t in out if t not in seen]; return seen
    return out
TZ = datetime.timezone(datetime.timedelta(hours=8))
def at(life, day, time):
    start = datetime.datetime.fromisoformat(life['start'])
    mid = start.replace(hour=0, minute=0, second=0, microsecond=0)
    h, m = map(int, time.split(':'))
    return int((mid + datetime.timedelta(days=day - 1, hours=h, minutes=m)).timestamp() * 1000)
def bound(s, end=False):
    if len(s) == 10: d = datetime.datetime.fromisoformat(s).replace(tzinfo=TZ)
    else:
        d = datetime.datetime.fromisoformat(s.replace('Z', '+00:00'))
        if d.tzinfo is None: d = d.replace(tzinfo=TZ)
    return int(d.timestamp() * 1000)
def main(run_dir, check_ranks=True):
    life = json.load(open(os.path.join(run_dir, 'life.json'))); arm = life['evaluation']['arm']; days = life['evaluation']['days']
    frozen = json.load(open(os.path.join(os.environ['ACC8'], 'eval/lives', life['id'] + '.json')))
    diff = [k for k in frozen if k not in ('writing_policy',) and frozen[k] != life.get(k)]
    con = sqlite3.connect(f'file:{run_dir}/data/archive.sqlite?mode=ro', uri=True); con.row_factory = sqlite3.Row
    ev = [dict(r) for r in con.execute('select * from events order by seq')]; con.close()
    for e in ev: e['meta'] = json.loads(e['meta'])
    by_id = {e['id']: e for e in ev}; by_seq = {e['seq']: e for e in ev}
    heard = [e for e in ev if e['class'] == 'experience' and e['kind'] == 'heard']
    writings = [e for e in ev if e['class'] == 'inner' and e['kind'] == 'wrote' and e['content'] != '']
    pres = [e for e in ev if e['kind'] == 'presented']
    problems = []
    # plants
    plants = {}
    for f in life['facts']:
        for v in f['versions']:
            plants[f['id'] + v.get('version', '')] = dict(t=at(life, v['day'], v['time']), text=v.get('text'), anchor=v['anchor'], day=v['day'], tail=v.get('text') is None)
    for p in life['people']:
        for i, m in enumerate(p['mentions']):
            plants[p['id'] + ('abcd'[i] if len(p['mentions']) > 1 else '')] = dict(t=at(life, m['day'], m['time']), text=m['text'], anchor=m['anchor'], day=m['day'])
    for s in life['sanity']:
        plants[s['id']] = dict(t=at(life, s['day'], s['time']), text=s['text'], anchor=s['anchor'], day=s['day'])
    loc = {}
    for pid, p in plants.items():
        if p['day'] > days: continue
        c = [h for h in heard if h['t_recorded'] == p['t'] and (h['content'] == p['text'] if p['text'] else (p['anchor'] in h['content']))]
        if len(c) != 1: problems.append(('primary not unique', pid, len(c))); continue
        loc[pid] = c[0]
        occ = [h['seq'] for h in heard if p['anchor'] in h['content']]
        if occ != [c[0]['seq']]: problems.append(('anchor not unique among heard', pid, p['anchor'], len(occ)))
        if any(p['anchor'] in e['content'] for e in ev if e['kind'] == 'said'): problems.append(('anchor in said', pid))
        if not p.get('tail') and p['anchor'] not in ''.join(list(c[0]['content'])[:32]): problems.append(('anchor beyond 32', pid))
    probes = [dict(id=p['id'], t=at(life, p['day'], p['time']), ask=p['ask'], query=p['query'], targets=p['targets'], tags=p.get('tags', []), day=p['day']) for p in life['probes']]
    probes += [dict(id=s['id'], t=at(life, s['day'], s['ask_time']), ask=s['ask'], query=s['query'], targets=[s['id']], tags=['sanity'], day=s['day']) for s in life['sanity']]
    rows, sanity_rows = [], []
    for p in probes:
        if p['day'] > days: continue
        hs = [h for h in heard if h['t_recorded'] == p['t'] and h['content'] == p['ask']]
        if len(hs) != 1: problems.append(('probe heard', p['id'], len(hs))); continue
        h = hs[0]; reqs = [q for q in pres if q['reply_to'] == h['id']]
        base = [q for q in reqs if q['meta'].get('step') == 0]
        if len(base) != 1: problems.append(('base', p['id'])); continue
        base = base[0]['meta']
        refs = {r['checked'] for q in reqs for s in q['meta']['sections'] if s['name'] == 'step' for r in s['results'] if 'checked' in r}
        checks = [e for e in ev if e['kind'] == 'checked' and e['reply_to'] == h['id']]
        shown = [c for c in checks if c['id'] in refs]
        for tid in p['targets']:
            if tid not in loc: problems.append(('target missing', p['id'], tid)); continue
            g = loc[tid]; anchor = plants[tid]['anchor']
            carriers = [w['seq'] for w in writings if w['seq'] > g['seq'] and anchor in w['content']]
            win = any(s['name'] == 'window' and s['first_seq'] <= g['seq'] <= s['last_seq'] for s in base['sections'])
            wri = any(s['name'] == 'writings' and any(s['first_seq'] <= w <= s['last_seq'] for w in carriers) for s in base['sections'])
            chk = any(g['seq'] in c['meta']['result_seqs'] for c in shown)
            chw = any(any(w in c['meta']['result_seqs'] for w in carriers) for c in shown)
            presented = win or wri or chk or chw
            c = checks[0] if checks else None
            q = p['query'].get('query', '')
            doc = set(tokens(g['content']))
            qterms = tokens(q, True)[:32]
            overlap = any(t in doc for t in qterms)
            used = any(t in doc for t in (c['meta'].get('terms') or [])) if c else False
            ranks = [cc['meta'].get('rank_seqs', []).index(g['seq']) + 1 for cc in checks if g['seq'] in cc['meta'].get('rank_seqs', [])]
            rank = min(ranks) if ranks else None
            reason = None
            if not presented:
                fr = bound(p['query']['from']) if 'from' in p['query'] else -math.inf
                to = bound(p['query']['to']) if 'to' in p['query'] else math.inf
                sel = c['meta']['result_seqs'] if c else []
                earliest = min(sel) if sel else math.inf
                eng = c['meta'].get('engine') if c else None; mode = c['meta'].get('mode') if c else None
                if not c: reason = 'no_check'
                elif not (fr <= g['t_recorded'] <= to): reason = 'outside_range'
                elif eng == 'scan' and q not in g['content']: reason = 'substring_miss'
                elif eng == 'scan' and g['seq'] < earliest: reason = 'recency_cut'
                elif eng == 'index' and not overlap: reason = 'no_overlap'
                elif eng == 'index' and not used: reason = 'dropped_only'
                elif mode == 'recent' and g['seq'] < earliest: reason = 'common_mode'
                else:
                    order = c['meta'].get('rank_seqs', []); picked = []; chars = 0; stopped_chars = False
                    def add(n):
                        nonlocal chars; picked.append(n); chars += len(by_seq[n]['content'])
                    if order:
                        add(order[0])
                        if mode == 'relevance' and sel and max(sel) not in picked: add(max(sel))
                    for n in order:
                        if n in picked: continue
                        if len(picked) >= 40: break
                        if chars + len(by_seq[n]['content']) > 16000: stopped_chars = True; break
                        add(n)
                    reason = 'budget_cut' if (rank is not None and rank <= 40 and stopped_chars) else 'ranked_out' if mode == 'relevance' else 'unexplained'
            age = (p['t'] - g['t_recorded']) / 86400000
            row = dict(probe=p['id'], target=tid, window=win, writing=wri, check=chk, check_writing=chw, presented=presented, rank=rank, reason=reason,
                       overlap=overlap, used_overlap=used, age_group='<1d' if age < 1 else '1-7d' if age <= 7 else '7-28d' if age <= 28 else '>28d', tags=p['tags'])
            (sanity_rows if 'sanity' in p['tags'] else rows).append(row)
    # writings consumption
    never = 0; via = 0
    for w in writings:
        seen = any(q['seq'] > w['seq'] and any(s['name'] == 'writings' and s['first_seq'] <= w['seq'] <= s['last_seq'] for s in q['meta']['sections']) for q in pres)
        vc = any(c['seq'] > w['seq'] and w['seq'] in c['meta'].get('result_seqs', []) for c in ev if c['kind'] == 'checked')
        never += (not seen and not vc); via += vc
    # canonical digest (own scheme)
    idmap = {e['id']: e['seq'] for e in ev}
    def norm(v):
        if isinstance(v, str) and v in idmap: return ['@seq', idmap[v]]
        if isinstance(v, list): return [norm(x) for x in v]
        if isinstance(v, dict): return {k: norm(x) for k, x in sorted(v.items())}
        return v
    canon = [[e['seq'], e['branch'], e['class'], e['kind'], e['scene'], e['actor'], e['t_recorded'], idmap.get(e['reply_to']), e['content'], e['model'], norm(e['meta'])] for e in ev]
    digest = hashlib.sha256(json.dumps(canon, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
    # rank truth: own FTS5 as of each check
    rank_problems = []; checked_n = 0
    if check_ranks:
        m = sqlite3.connect(':memory:'); m.execute("create virtual table t using fts5(x, content='', tokenize='ascii')"); m.execute("create table d(seq integer primary key, ts integer, kind text)")
        m.execute("create virtual table v using fts5vocab(t,'row')")
        scope = (heard[0]['scene'], heard[0]['branch'])
        for e in ev:
            if e['kind'] == 'checked' and e['meta'].get('rules') == 'p8' and e['meta'].get('engine') == 'index' and not e['meta'].get('invalid'):
                cm = e['meta']; checked_n += 1; a = cm['arguments']; q = a.get('query', '')
                fr = bound(a['from']) if 'from' in a else -1e18; to = bound(a['to']) if 'to' in a else 1e18
                qt = tokens(q, True)[:32]
                df = sorted([(m.execute('select doc from v where term=?', (t,)).fetchone() or [0])[0], i, t] for i, t in enumerate(qt))
                usedt, dropped, s = [], [], 0
                for n, i, t in df:
                    if not usedt or s + n <= 50000: usedt.append((n, t)); s += n
                    else: dropped.append(t)
                common = bool(usedt) and usedt[0][0] > 50000
                if common: dropped = [t for _, t in usedt[1:]] + dropped; usedt = usedt[:1]
                words = [t for _, t in usedt]
                if words != cm['terms'] or dropped != cm['dropped']: rank_problems.append(('terms', e['seq'], words, cm['terms'], dropped, cm['dropped']))
                if q:
                    mq = ' OR '.join('"' + w.replace('"', '""') + '"' for w in words)
                    order = 'rank, t.rowid desc' if not common else 't.rowid desc'
                    got = [r[0] for r in m.execute(f'select t.rowid from t join d on d.seq=t.rowid where t match ? and d.ts between ? and ? order by {order} limit 100', (mq, fr, to))]
                    total = m.execute('select count(*) from t join d on d.seq=t.rowid where t match ? and d.ts between ? and ?', (mq, fr, to)).fetchone()[0]
                    newest = m.execute('select max(t.rowid) from t join d on d.seq=t.rowid where t match ? and d.ts between ? and ?', (mq, fr, to)).fetchone()[0]
                else:
                    got = [r[0] for r in m.execute('select seq from d where ts between ? and ? order by seq desc limit 100', (fr, to))]
                    total = m.execute('select count(*) from d where ts between ? and ?', (fr, to)).fetchone()[0]; newest = got[0] if got else None
                if got != cm['rank_seqs']: rank_problems.append(('rank_seqs', e['seq'], q, got[:5], cm['rank_seqs'][:5]))
                if total != cm['total']: rank_problems.append(('total', e['seq'], total, cm['total']))
                rs = cm['result_seqs']
                if rs != sorted(rs): rank_problems.append(('not chronological', e['seq']))
                extra = [x for x in rs if x not in cm['rank_seqs']]
                if extra and not (cm['mode'] == 'relevance' and extra == [newest]): rank_problems.append(('result outside top100 not newest', e['seq'], extra, newest))
                if got and got[0] not in rs: rank_problems.append(('top1 missing', e['seq']))
                if cm['mode'] == 'relevance' and newest is not None and newest not in rs: rank_problems.append(('newest missing', e['seq']))
            if e['scene'] == scope[0] and e['branch'] == scope[1] and ((e['class'], e['kind']) in [('experience', 'heard'), ('act', 'said'), ('act', 'silent')] or (e['class'] == 'inner' and e['kind'] == 'wrote' and e['content'] != '')):
                m.execute('insert into d values(?,?,?)', (e['seq'], e['t_recorded'], e['kind']))
                tk = tokens(e['content'])
                if tk: m.execute('insert into t(rowid,x) values(?,?)', (e['seq'], ' '.join(tk)))
    cov = lambda rs: [sum(r['presented'] for r in rs), len(rs)]
    reasons = {}
    for r in rows:
        if r['reason']: reasons[r['reason']] = reasons.get(r['reason'], 0) + 1
    return dict(life=life['id'], arm=arm, policy=life['writing_policy'], script_diff=diff, problems=problems, events=len(ev), digest=digest,
                overall=cov(rows), age={k: cov([r for r in rows if r['age_group'] == k]) for k in ['<1d', '1-7d', '7-28d', '>28d']},
                channels={k: sum(r[k] for r in rows) for k in ['window', 'writing', 'check', 'check_writing']},
                tags={k: cov([r for r in rows if k in r['tags']]) for k in ['high_frequency', 'correction', 'expected_miss']},
                gap=dict(overlap=sum(r['overlap'] for r in rows), used=sum(r['used_overlap'] for r in rows), ranked_100=sum(r['rank'] is not None for r in rows), presented=sum(r['presented'] for r in rows)),
                reasons=reasons, sanity_window=[sum(r['window'] for r in sanity_rows), len(sanity_rows)], sanity_any=[sum(r['presented'] for r in sanity_rows), len(sanity_rows)],
                writings=dict(n=len(writings), never=never, via_check=via), wrote=sum(e['kind'] == 'wrote' for e in ev), checks_verified=checked_n, rank_problems=rank_problems[:10], rank_problem_count=len(rank_problems),
                rows=rows)
if __name__ == '__main__':
    out = main(sys.argv[1], check_ranks=len(sys.argv) < 3)
    print(json.dumps({k: v for k, v in out.items() if k != 'rows'}, ensure_ascii=False))
    json.dump(out, open(sys.argv[1].rstrip('/') + '.claude-measure.json', 'w'), ensure_ascii=False)
