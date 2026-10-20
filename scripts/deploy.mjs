#!/usr/bin/env node
/**
 * 部署入口：先把 `scripts/deploy.ps1` 的编码修对，再交给 PowerShell 执行。
 *
 * ## 为什么需要这一层
 *
 * `deploy.ps1` 里有大量中文注释与中文输出。Windows PowerShell 5.1 读取
 * **无 BOM** 的 `.ps1` 时按系统 ANSI 代码页解码（中文 Windows 上是 GBK），
 * UTF-8 的中文变成乱码，字符串里的引号位置随之错位，于是报一堆：
 *
 *   “,”后面缺少表达式。
 *   字符串缺少终止符: "。
 *   表达式或语句中包含意外的标记“}”。
 *
 * 看起来像语法错误，实际只是编码 —— 2026-10-19 当晚 `npm run deploy` 因此
 * 完全跑不起来，排查时先怀疑了语法、缩进、PowerShell 版本，最后才发现文件
 * 头部少了 3 个字节。
 *
 * 触发条件很普通：用任何「不保留 BOM」的编辑器或脚本改一次这个文件，BOM 就
 * 没了（本次是 `git checkout` / 文本编辑各丢过一次）。靠「记得别丢」不可维护，
 * 所以在入口处兜住：**只要字节不是 EF BB BF 就补上**，然后正常执行。
 *
 * 顺带把 `deploy.ps1` 的其余前置条件说清楚，省得下次再猜：
 *   - `wrangler deploy` 在 `Read N files` 之后有 8–10 分钟的静默期（本地算
 *     哈希 + 与远端清单求差集）。CPU 与输出都接近静止是**预期行为**。
 *     不要用 3–4 分钟的超时去判断卡死 —— 那会把正常部署杀掉，看起来像死锁。
 *   - 部署体量：`--lean` 之后约 13,000 个文件；Cloudflare 上限 20,000。
 *
 * Usage:
 *   npm run deploy                       # 构建 + 守卫 + prune + 部署
 *   npm run deploy -- -SkipBuild         # 直接部署现有 out/
 *   npm run deploy -- -MaxAttempts 5
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(ROOT, 'scripts', 'deploy.ps1');

const BOM = Buffer.from([0xef, 0xbb, 0xbf]);

let buf;
try {
  buf = readFileSync(SCRIPT);
} catch (err) {
  console.error(`读不了 scripts/deploy.ps1：${err.message}`);
  process.exit(1);
}

if (!buf.subarray(0, 3).equals(BOM)) {
  // 确认它确实是 UTF-8（而不是 GBK 之类的其它编码，那种情况补 BOM 会掩盖问题）
  const text = buf.toString('utf8');
  if (text.includes('\uFFFD')) {
    console.error(
      'scripts/deploy.ps1 不是有效的 UTF-8（含替换字符）—— 先把它转成 UTF-8 再部署。',
    );
    process.exit(1);
  }
  writeFileSync(SCRIPT, Buffer.concat([BOM, buf]));
  console.log('[deploy] scripts/deploy.ps1 缺少 UTF-8 BOM，已自动补上（否则 PowerShell 会按 GBK 解码中文并报语法错）');
}

const r = spawnSync(
  'powershell',
  ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT, ...process.argv.slice(2)],
  { cwd: ROOT, stdio: 'inherit' },
);

process.exit(r.status ?? 1);
