/**
 * AIHOT 抓取脚本的字段映射测试。
 *
 * 为什么值得测：`scripts/fetch-aihot.mjs` 把上游 v1 的响应映射成本站形状，
 * 上游改字段名（比如 `links.original` 改名）时不会报错，只会让**卡片跳转全部
 * 失效**或**丢掉署名** —— 后者还违反 AIHOT《公开使用规则》第 5、6 条。
 *
 * 这里不联网：直接测映射与降级这两个纯逻辑。脚本没有导出内部函数，所以用
 * 「把源码读进来 + 在受控环境里跑」的方式验证对外行为，也就是它对一份固定
 * 输入产出的结果。
 *
 * 做法：起一个本地 HTTP 服务器伪造 v1 响应，把脚本指向它（脚本支持
 * `AIHOT_API_BASE` 覆盖地址），然后检查写出的 data/news.json。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, copyFileSync, existsSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NEWS = join(ROOT, 'data', 'news.json');
const META = join(ROOT, 'data', 'aihot-meta.json');
const NEWS_BAK = join(ROOT, 'work', 'test-news.bak');
const META_BAK = join(ROOT, 'work', 'test-meta.bak');

/** 起一个假 v1 端点，返回给定的 items；用完即关。 */
function fakeApi(handler) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const body = handler(req);
      if (body === null) {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end('{"error":"boom"}');
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json', etag: 'W/"test"' });
      res.end(JSON.stringify(body));
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

/** 跑抓取脚本，返回 { code, stdout }。 */
function runFetch(port, extraArgs = []) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, ['scripts/fetch-aihot.mjs', ...extraArgs], {
      cwd: ROOT,
      env: { ...process.env, AIHOT_API_BASE: `http://127.0.0.1:${port}/api/v1` },
    });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (out += d));
    p.on('close', (code) => resolve({ code, stdout: out }));
  });
}

function backup() {
  if (existsSync(NEWS)) copyFileSync(NEWS, NEWS_BAK);
  if (existsSync(META)) copyFileSync(META, META_BAK);
}
function restore() {
  if (existsSync(NEWS_BAK)) copyFileSync(NEWS_BAK, NEWS);
  if (existsSync(META_BAK)) copyFileSync(META_BAK, META);
}

/** 一条形状正确的 v1 item。 */
const goodItem = (over = {}) => ({
  id: 'cm_test_1',
  title: '测试中文标题',
  originalTitle: 'Test English Title',
  summary: '这是中文摘要。',
  source: { name: '测试来源' },
  links: { aihot: 'https://aihot.news/items/cm_test_1', original: 'https://example.com/a' },
  publishedAt: '2026-10-15T11:00:00.000Z',
  category: 'ai-models',
  reason: '入选理由',
  ...over,
});

test('字段映射：v1 → 本站形状，署名与原文链接必须保留', async () => {
  backup();
  const { server, port } = await fakeApi(() => ({
    schemaVersion: 1,
    items: [goodItem()],
    page: { hasMore: false, nextCursor: null },
  }));
  try {
    const { code } = await runFetch(port);
    assert.equal(code, 0, '脚本应成功退出');

    const n = JSON.parse(readFileSync(NEWS, 'utf8'));
    assert.equal(n.length, 1);
    const it = n[0];
    assert.equal(it.title, '测试中文标题');
    assert.equal(it.originalTitle, 'Test English Title');
    assert.equal(it.source, '测试来源');
    // 这两个是合规要求，缺了就是丢署名/死链
    assert.equal(it.originalUrl, 'https://example.com/a');
    assert.equal(it.aihotUrl, 'https://aihot.news/items/cm_test_1');
    assert.equal(it.categoryLabel, 'AI 模型');
    assert.equal(it.publishedAt, '2026-10-15T11:00:00.000Z');
  } finally {
    server.close();
    restore();
  }
});

test('缺 links.original 的条目被丢弃（不渲染死链）', async () => {
  backup();
  const { server, port } = await fakeApi(() => ({
    schemaVersion: 1,
    items: [
      goodItem(),
      goodItem({ id: 'no_link', links: { aihot: 'https://aihot.news/items/no_link' } }),
    ],
    page: { hasMore: false, nextCursor: null },
  }));
  try {
    const { code, stdout } = await runFetch(port);
    // 断言带上 stdout：这条用例曾在整机跑 build 时偶发 code=1，而子进程的输出
    // 被断言吞掉了，只能看到「实际 1」看不出原因。机器过载时 Node 起不来也是 1，
    // 和「抓取失败且无历史数据」的 1 长得一样，必须靠输出区分。
    assert.equal(code, 0, `脚本应成功退出，实际 ${code}：\n${stdout}`);
    const n = JSON.parse(readFileSync(NEWS, 'utf8'));
    assert.equal(n.length, 1, '只应保留有原文链接的那条');
    assert.equal(n[0].id, 'cm_test_1');
    assert.match(stdout, /跳过 1 条/, '应报告丢弃数量');
  } finally {
    server.close();
    restore();
  }
});

test('缺 title 的条目被丢弃', async () => {
  backup();
  const { server, port } = await fakeApi(() => ({
    schemaVersion: 1,
    items: [goodItem({ id: 'no_title', title: undefined })],
    page: { hasMore: false, nextCursor: null },
  }));
  try {
    const { code, stdout } = await runFetch(port);
    assert.equal(code, 0);
    // 全部被丢弃时，脚本应保留上一版而不是写空文件
    const n = JSON.parse(readFileSync(NEWS, 'utf8'));
    assert.ok(n.length > 0, '不应把 news.json 写成空');
    assert.match(stdout, /保留现有|映射后 0 条/);
  } finally {
    server.close();
    restore();
  }
});

test('未知 category 回退成「AI 动态」而不是 undefined', async () => {
  backup();
  const { server, port } = await fakeApi(() => ({
    schemaVersion: 1,
    items: [goodItem({ category: 'brand-new-category' })],
    page: { hasMore: false, nextCursor: null },
  }));
  try {
    await runFetch(port);
    const n = JSON.parse(readFileSync(NEWS, 'utf8'));
    assert.equal(n[0].categoryLabel, 'AI 动态');
  } finally {
    server.close();
    restore();
  }
});

test('接口 5xx 且有历史数据时：警告但 exit 0（不搞挂构建）', async () => {
  backup();
  const { server, port } = await fakeApi(() => null); // 永远 500
  try {
    const { code, stdout } = await runFetch(port);
    assert.equal(code, 0, '有历史数据时必须 exit 0');
    assert.match(stdout, /保留现有/);
  } finally {
    server.close();
    restore();
  }
});

test('接口 5xx 且无历史数据时：exit 1（明确报错而不是产出空站）', async () => {
  backup();
  const { server, port } = await fakeApi(() => null);
  try {
    if (existsSync(NEWS)) unlinkSync(NEWS);
    const { code, stdout } = await runFetch(port);
    assert.equal(code, 1, '没有历史数据时必须 exit 1');
    assert.match(stdout, /没有历史数据/);
  } finally {
    server.close();
    restore();
  }
});
