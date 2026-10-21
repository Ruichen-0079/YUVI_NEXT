// Isolated probe: Chinese full-text options on node:sqlite FTS5. Synthetic data only.
// Usage: node cjk.mjs <dir containing node_modules with @node-rs/jieba> <N> <outdir> [and|or] [schemes]
// CONTENTLESS=1 builds contentless (content='') indexes to measure index-only size.
import { DatabaseSync } from 'node:sqlite';
import { createRequire } from 'node:module';
import { rmSync, statSync } from 'node:fs';
const require = createRequire(process.argv[2] + '/');           // probe node_modules dir
const { Jieba } = require('@node-rs/jieba');
const { dict } = require('@node-rs/jieba/dict');
const jieba = Jieba.withDict(dict);
const N = Number(process.argv[3] ?? 20000);
const out = process.argv[4];
const MODE = process.argv[5] ?? 'and';
const SCHEMES = (process.argv[6] ?? 'trigram,segmenter,grams,seg_grams,jieba').split(',');

// ---------- synthetic corpus ----------
const words = `今天 天气 不错 我们 一起 去 公园 散步 晚上 吃饭 火锅 工作 有点 累 周末 想 看 电影 朋友 聊天 最近 在 读 一本 小说 写 代码 调试 程序 出门 下雨 带伞 买 咖啡 喝 早上 起床 迟到 地铁 很 挤 开会 讨论 项目 计划 下周 出差 上海 北京 家里 打扫 房间 做饭 洗碗 音乐 听 歌 跑步 健身 学习 英语 考试 复习 记得 提醒 生日 礼物 妈妈 电话 爸爸 猫 狗 喂 散心 心情 好 不太 开心 担心 明天 下午 晚点 再说 好的 谢谢 抱歉 其实 觉得 可能 应该 已经 还是 因为 所以 但是 然后`.split(' ');
let seed = 42; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = a => a[Math.floor(rnd() * a.length)];
const sentence = n => Array.from({ length: n }, () => pick(words)).join('') + '。';
const docs = [];
for (let i = 0; i < N; i++) docs.push(Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => sentence(6 + Math.floor(rnd() * 10))).join(''));
// planted targets (id -> text), placed early so they are "old"
const planted = {
  tea: '说起来，我的茶叶偏好一直是乌龙，最近换成了月桂-5967那款。',
  cat: '更正：我的猫叫年糕，不是汤圆。',
  editor: '之前编辑器代号说错了，现在用的是露川-4A87，栀子-613已经无效。',
  english: 'I switched my editor theme to Solarized Dark yesterday, VS Code feels better now.',
  mixed: '我把 VS Code 的主题换成了 Solarized Dark，眼睛舒服多了。',
  amber: '今天天气不错，我们去公园散步，看到一棵 amber spruce 很漂亮。',
  longtail: Array.from({ length: 160 }, () => pick(words)).join('') + '……最后补一句，备忘编号 LONGTAIL_9762 别忘了。',
  tail2: '这件事的关键在于沟通，' + sentence(300) + '对了，那家店叫青梧书屋。',
};
const plantedIds = {};
let pos = 7;
for (const [k, v] of Object.entries(planted)) { docs.splice(pos, 0, v); pos += 3; }
docs.forEach((d, i) => { for (const [k, v] of Object.entries(planted)) if (d === v) plantedIds[k] = i + 1; });
// high-frequency distractors: many later docs with 天气/今天/公园/amber or spruce alone
for (let i = 0; i < 300; i++) docs.push('今天天气' + sentence(8) + (i % 2 ? ' amber ' : ' spruce ') + '公园。');

// ---------- tokenizers ----------
const seg = new Intl.Segmenter('zh', { granularity: 'word' });
const isHan = s => /\p{Script=Han}/u.test(s);
const words_ = t => [...seg.segment(t)].filter(s => s.isWordLike).map(s => s.segment.toLowerCase());
const hanGrams = t => { const out = []; for (const run of t.match(/\p{Script=Han}+/gu) ?? []) { const c = [...run]; c.forEach((ch, i) => { out.push(ch); if (i + 1 < c.length) out.push(ch + c[i + 1]); }); } return out; };
const latin = t => (t.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter(w => !isHan(w));
const tok = {
  segmenter: t => words_(t),
  grams: t => [...hanGrams(t), ...latin(t)],
  seg_grams: t => [...words_(t), ...hanGrams(t)],
  jieba: t => jieba.cutForSearch(t, true).map(s => s.trim().toLowerCase()).filter(s => /[\p{L}\p{N}]/u.test(s)),
};
// query side: for gram schemes, a Han run becomes the bigram chain (phrase); single char stays unigram
const q = {
  segmenter: t => words_(t),
  grams: t => [...(t.match(/\p{Script=Han}+/gu) ?? []).map(r => { const c = [...r]; return c.length === 1 ? c : c.slice(0, -1).map((ch, i) => ch + c[i + 1]); }).flat(), ...latin(t)],
  jieba: t => jieba.cutForSearch(t, true).map(s => s.trim().toLowerCase()).filter(s => /[\p{L}\p{N}]/u.test(s)),
};
q.seg_grams = q.grams;
const quote = w => '"' + w.replaceAll('"', '""') + '"';
const queries = [
  ['茶叶', 'tea'], ['茶', 'tea'], ['年糕', 'cat'], ['猫叫什么', 'cat'], ['露川-4A87', 'editor'], ['4A87', 'editor'],
  ['编辑器', 'editor'], ['editor', 'english'], ['Solarized', 'mixed'], ['VS Code 主题', 'mixed'],
  ['amber spruce', 'amber'], ['LONGTAIL_9762', 'longtail'], ['青梧书屋', 'tail2'], ['喜欢的茶', 'tea'],
];

const results = {};
for (const scheme of SCHEMES) {
  const file = `${out}/${scheme}.sqlite`; rmSync(file, { force: true });
  const db = new DatabaseSync(file);
  db.exec(scheme === 'trigram' ? "CREATE VIRTUAL TABLE f USING fts5(body, tokenize='trigram')"
    : `CREATE VIRTUAL TABLE f USING fts5(body, ${process.env.CONTENTLESS ? "content='', contentless_delete=1, " : ''}tokenize='unicode61 remove_diacritics 0')`);
  const ins = db.prepare('INSERT INTO f(rowid, body) VALUES (?, ?)');
  let t0 = performance.now();
  db.exec('BEGIN');
  docs.forEach((d, i) => ins.run(i + 1, scheme === 'trigram' ? d : tok[scheme](d).join(' ')));
  db.exec('COMMIT');
  const insertMs = performance.now() - t0;
  db.exec("INSERT INTO f(f) VALUES('optimize')");
  const rows = [];
  const lat = [];
  for (const [text, key] of queries) {
    let match;
    if (scheme === 'trigram') {
      // trigram: each whitespace part >=3 chars as phrase; shorter parts cannot be indexed -> LIKE fallback measured separately
      const parts = text.split(/\s+/);
      match = parts.every(p => [...p].length >= 3) ? parts.map(quote).join(MODE === 'or' ? ' OR ' : ' ') : null;
    } else {
      const terms = q[scheme](text);
      // gram schemes: Han bigram chain must be adjacent -> phrase over bigrams; others AND
      match = terms.length ? [...new Set(terms)].map(quote).join(MODE === 'or' ? ' OR ' : ' ') : null;
    }
    let ids = [], ms = 0;
    if (match) {
      const st = db.prepare('SELECT rowid FROM f WHERE f MATCH ? ORDER BY bm25(f) LIMIT 8');
      const t1 = performance.now(); const each=[]; for (let r = 0; r < 20; r++) { const a = performance.now(); ids = st.all(match).map(r => r.rowid); each.push(performance.now() - a); } each.sort((x,y)=>x-y); ms = each[18];
    } else if (scheme === 'trigram') {
      const st = db.prepare('SELECT rowid FROM f WHERE body LIKE ? LIMIT 8');
      const t1 = performance.now(); ids = st.all('%' + text + '%').map(r => r.rowid); ms = performance.now() - t1;
    }
    lat.push(ms);
    rows.push({ q: text, hit: ids.includes(plantedIds[key]), rank: ids.indexOf(plantedIds[key]) + 1 || null, ms: +ms.toFixed(2), via: match ? 'match' : 'like/none' });
  }
  db.close();
  results[scheme] = { insertMs: Math.round(insertMs), sizeMB: +(statSync(file).size / 1e6).toFixed(1), hits: rows.filter(r => r.hit).length + '/' + rows.length, rows };
}
console.log(JSON.stringify({ N: docs.length, MODE, results }, null, 1));
