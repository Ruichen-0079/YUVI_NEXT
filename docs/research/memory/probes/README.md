# 选型探针（2026-10-21）

隔离的小规模技术探针，用来支撑 [06-selection.md](../06-selection.md) 的结论。

- **不是产品代码：** 不被 `npm test` 运行，不进入 `src/`。
- **数据：** 全部为脚本生成的合成数据，不含任何真实对话。
- **依赖：** 探针用到的第三方包（`@node-rs/jieba`、`sqlite-vec`）只安装在仓库外的临时目录，不写进 `package.json`。

**环境：**

- Node v22.22.0，内置 SQLite 3.50.4（编译选项含 `ENABLE_FTS5`、`ENABLE_RTREE`、`ENABLE_MATH_FUNCTIONS`）；
- 4 vCPU Intel Xeon 2.8 GHz，Linux。

数字只用于方案之间的比较，不是性能承诺。

## 复现

```sh
TMP=$(mktemp -d)
(cd "$TMP" && npm init -y >/dev/null && npm install @node-rs/jieba@2.0.4 sqlite-vec@0.1.9)

# 中文全文检索：五种分词方案，AND / OR 两种查询语义
node cjk.mjs "$TMP/node_modules" 20000 "$TMP" and   | node show.cjs /dev/stdin
node cjk.mjs "$TMP/node_modules" 20000 "$TMP" or    | node show.cjs /dev/stdin
node cjk.mjs "$TMP/node_modules" 200000 "$TMP" or trigram,grams,jieba | node show.cjs /dev/stdin
CONTENTLESS=1 node cjk.mjs "$TMP/node_modules" 200000 "$TMP" or grams,jieba | node show.cjs /dev/stdin

# 向量：JS 暴力余弦 vs sqlite-vec（vec0）
node vec.mjs "$TMP/node_modules"

# 档案：100 万事件，P4 schema 下每回合查询的耗时（需要先在仓库根目录 npm run build）
node archive.mjs /path/to/YUVI_NEXT "$TMP/archive-1m.sqlite"

# node:test 的模拟时钟（加速时间）
node --test clock.test.mjs
```

`results/` 中是本次运行的原始输出。
