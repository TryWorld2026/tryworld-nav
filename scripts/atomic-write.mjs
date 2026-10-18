/**
 * 原子写一个 JSON/文本文件：先写 `.tmp`，再 `rename` 覆盖目标。
 *
 * 为什么不直接 `writeFileSync`：构建与抓取可能同时在跑，读到半截 JSON 会
 * 让 `next build` 在第 300 个页面才崩，报错还指向完全无关的地方。
 *
 * 为什么 rename 要重试：Windows 上 `MoveFileEx` 会以 `EPERM` / `EBUSY`
 * 拒绝「目标文件此刻被别人打开」的请求——杀毒软件的实时扫描、编辑器/文件
 * 索引器、甚至上一毫秒刚被 `copyFileSync` 写过的目标，都够触发。这不是
 * 逻辑错误，重试几十毫秒就好。2026-10-18 实测：`tests/fetch-aihot.test.mjs`
 * 单独连跑 8 次会挂 1 次，报的正是
 * `EPERM: rename 'data/news.json.tmp' -> 'data/news.json'`，跑 `npm run build`
 * 时同样可能撞上，而那时整次构建会以 1 退出。
 */
import { writeFileSync, renameSync, unlinkSync } from 'node:fs';

/** 同步小睡。脚本是纯 CLI，不值得为一次重试把整条调用链改成 async。 */
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * @param {string} path 目标路径
 * @param {string} text 文件内容
 * @param {{ attempts?: number }} [opts]
 */
export function writeAtomicSync(path, text, opts = {}) {
  const attempts = opts.attempts ?? 6;
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, text, 'utf8');

  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      renameSync(tmp, path);
      return;
    } catch (err) {
      lastError = err;
      // 只有「别人正拿着目标」这一类才值得重试；路径不存在、权限真的没有，
      // 多试几次也还是同一个错，直接抛。
      if (err.code !== 'EPERM' && err.code !== 'EBUSY' && err.code !== 'EACCES') break;
      sleepSync(20 * (i + 1));
    }
  }

  try {
    unlinkSync(tmp);
  } catch {
    // 临时文件删不掉不影响结论：真正的错误在 lastError 里。
  }
  throw lastError;
}
