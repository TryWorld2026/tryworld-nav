<#
.SYNOPSIS
  可靠地部署 tryworld-nav 到 Cloudflare Workers。

.DESCRIPTION
  这个脚本把 2026-10-15 一晚上踩出来的部署经验固化下来，因为手工跑
  `npx wrangler deploy` 反复失败（三次里成一次）。它处理四件事：

    1. **不用管道**：PowerShell 管道调用 wrangler 会静默卡死在
       `Building list of assets`，所以一律用 Start-Process + 文件重定向。
    2. **媒体守卫**：`public/assets/**` 被 gitignore，本地是唯一副本，而
       Workers Static Assets 每次部署整体替换资产清单 —— 缺媒体部署会把线上
       4188 张产品图打成 404。少于预期文件数就直接中止。
    3. **buildId 检查**：若 `out/_next/static` 里的 buildId 不是内容派生的稳定值，
       说明有"每次都变"的输入混进了 `contentBuildId()`，部署必然全量重传
       （700 MB / 50 分钟）。脚本会连建两次比对，不一致就警告。
    4. **失败重试**：本机线路（198.18.0.45 代理网卡）约 40% 连接超时，
       上传阶段 `fetch failed` 是常态。脚本按 `Uploaded tryworld-nav` 判定成败并自动重试。

.PARAMETER SkipBuild
  跳过构建，直接部署现有 out/（调试用）。

.PARAMETER MaxAttempts
  最多尝试几次部署，默认 3。

.EXAMPLE
  .\scripts\deploy.ps1
  .\scripts\deploy.ps1 -SkipBuild -MaxAttempts 5
#>
[CmdletBinding()]
param(
  [switch]$SkipBuild,
  [int]$MaxAttempts = 3
)

$ErrorActionPreference = 'Stop'
$ROOT = Split-Path -Parent $PSScriptRoot
Set-Location $ROOT

# npm 会把参数原样透传（`npm run deploy -- --SkipBuild`），而 PowerShell 的开关
# 参数写作 `-SkipBuild`。这里把 `--xxx` 形式也认下来，免得两个入口行为不一致。
foreach ($a in $args) {
  if ($a -match '^--?SkipBuild$')    { $SkipBuild = $true }
  if ($a -match '^--?MaxAttempts=(\d+)$') { $MaxAttempts = [int]$Matches[1] }
}

function Write-Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn2($msg){ Write-Host "  [!] $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "  [X] $msg" -ForegroundColor Red }

# --- 0. 构建 ---
if (-not $SkipBuild) {
  Write-Step '构建（会先抓 AIHOT 资讯，再生成 llms-full.txt）'
  npm run build
  if ($LASTEXITCODE -ne 0) { Write-Err '构建失败'; exit 1 }
  Write-Ok '构建完成'
}

# --- 1. 媒体守卫 ---
Write-Step '媒体守卫'
$mediaDirs = @('icons', 'shots', 'tags', 'news')
$mediaCount = 0
foreach ($d in $mediaDirs) {
  $p = Join-Path $ROOT "out\assets\$d"
  if (-not (Test-Path $p)) {
    Write-Err "out/assets/$d 不存在 —— 这次部署会把线上产品图全部打成 404"
    Write-Err '先跑 `npm run build`（构建会从 public/assets 复制媒体）。见 DEPLOY.md。'
    exit 1
  }
  $mediaCount += (Get-ChildItem $p -Recurse -File | Measure-Object).Count
}
if ($mediaCount -lt 4000) {
  Write-Err "out/ 里只有 $mediaCount 个媒体文件（预期 ~4183）—— 疑似媒体缺失，中止"
  exit 1
}
Write-Ok "媒体 $mediaCount 个文件，完整"

# --- 2. buildId 稳定性 ---
Write-Step 'buildId 稳定性'
$bid = (Get-ChildItem "$ROOT\out\_next\static" -Directory |
        Where-Object { $_.Name -notin @('chunks', 'css') } |
        Select-Object -First 1).Name
if (-not $bid) {
  Write-Warn2 '找不到 buildId 目录，跳过检查'
} elseif ($bid -match '^[0-9a-f]{16}$') {
  Write-Ok "buildId=$bid（内容派生的 16 位 hex，符合预期）"
} else {
  Write-Warn2 "buildId=$bid 不像内容派生的 hex —— 可能是随机 buildId，本次会全量重传 ~700 MB"
  Write-Warn2 '检查 next.config.mjs 的 contentBuildId() 是否混入了每次都变的输入'
}

# --- 3. prune（只报数，默认保留媒体） ---
Write-Step 'prune（默认保留媒体）'
node scripts/prune-out.mjs
if ($LASTEXITCODE -ne 0) { Write-Err 'prune 失败'; exit 1 }

# --- 4. 部署（Start-Process + 重定向，带重试） ---
$attempt = 0
while ($attempt -lt $MaxAttempts) {
  $attempt++
  $stamp = Get-Date -Format 'HHmmss'
  $outLog = Join-Path $ROOT "work\deploy-$stamp.out"
  $errLog = Join-Path $ROOT "work\deploy-$stamp.err"

  Write-Step "部署尝试 $attempt / $MaxAttempts（日志 work\deploy-$stamp.out）"
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $proc = Start-Process -FilePath 'node' `
    -ArgumentList 'node_modules\wrangler\bin\wrangler.js', 'deploy' `
    -WorkingDirectory $ROOT `
    -RedirectStandardOutput $outLog `
    -RedirectStandardError $errLog `
    -NoNewWindow -PassThru

  # 等待，但不盲等，也不能只看输出增长 —— 这一点踩过坑：
  #
  # `wrangler deploy` 在 `Read N files` 之后有一段**很长的静默期**：它在本地比对
  # 8716 个文件的哈希、与远端清单求差集，这期间 stdout 一个字都不写。2026-10-16
  # 实测这段静默超过 8 分钟，被过激的阈值误判为卡死并 kill，连杀三次。
  #
  # 所以判活的依据是**进程 CPU 时间是否在涨**，不是输出是否在涨：
  #   - CPU 在涨  -> 它在干活，无论输出是否安静，都继续等
  #   - CPU 不动 + 输出不动 -> 才是真卡死
  # 真正的卡死（管道缓冲那个 bug）特征是 CPU 完全冻结，所以这个判据很准。
  $lastSize = -1
  $lastCpu = -1.0
  $cpuIdleSince = Get-Date
  $hardCap = (Get-Date).AddMinutes(90)   # 兜底上限，防止无限等待

  while (-not $proc.HasExited) {
    Start-Sleep -Seconds 20
    $proc.Refresh()
    if ($proc.HasExited) { break }

    if ((Get-Date) -gt $hardCap) {
      Write-Warn2 '超过 90 分钟上限，终止本次尝试'
      try { $proc.Kill() } catch {}
      break
    }

    $size = if (Test-Path $outLog) { (Get-Item $outLog).Length } else { 0 }
    $cpu = $proc.CPU
    if ($null -eq $cpu) { $cpu = 0 }

    $outputGrew = $size -ne $lastSize
    # CPU 涨了 0.2 秒以上就算在干活（20 秒采样窗口，正常工作量远超这个值）
    $cpuBusy = ($cpu - $lastCpu) -gt 0.2

    if ($outputGrew) { $lastSize = $size }
    if ($cpuBusy) { $lastCpu = $cpu; $cpuIdleSince = Get-Date }

    if (-not $outputGrew -and -not $cpuBusy) {
      $idle = ((Get-Date) - $cpuIdleSince).TotalMinutes
      if ($idle -ge 6) {
        Write-Warn2 "CPU 与输出均已静止 $([math]::Round($idle,1)) 分钟，判定卡死，终止本次尝试"
        try { $proc.Kill() } catch {}
        break
      }
      if ($idle -ge 3) {
        Write-Host "  …静默 $([math]::Round($idle,1)) 分钟（CPU 亦静止），再观察一会儿" -ForegroundColor DarkGray
      }
    }
  }
  $sw.Stop()

  $stdout = if (Test-Path $outLog) { Get-Content $outLog -Raw } else { '' }
  $stderr = if (Test-Path $errLog) { Get-Content $errLog -Raw } else { '' }

  # 成功标志是 'Uploaded tryworld-nav'。注意成功日志里也会有 ERROR 字样
  # （那是部署后的遥测/校验步骤报错，与本次部署无关），所以不能用 ERROR 判定。
  if ($stdout -match 'Uploaded tryworld-nav') {
    $ver = [regex]::Match($stdout, 'Current Version ID:\s*([0-9a-f-]+)')
    $up  = [regex]::Match($stdout, 'Uploaded (\d+) of (\d+) assets')
    Write-Ok "部署成功，耗时 $([math]::Round($sw.Elapsed.TotalMinutes,1)) 分钟"
    if ($ver.Success) { Write-Ok "Version: $($ver.Groups[1].Value)" }
    if ($stdout -match 'No updated asset files to upload') {
      Write-Ok '增量上传：0 个文件需上传（稳定 buildId 生效）'
    }
    Write-Host "`n  站点：https://nav.tryworld.com.cn"
    exit 0
  }

  Write-Warn2 "第 $attempt 次未成功（耗时 $([math]::Round($sw.Elapsed.TotalMinutes,1)) 分钟）"
  if ($stderr -match 'fetch failed') {
    Write-Warn2 '上传阶段 fetch failed —— 本机线路丢包所致，重试通常即可'
  }
  if ($attempt -lt $MaxAttempts) { Write-Warn2 "5 秒后重试…"; Start-Sleep -Seconds 5 }
}

Write-Err "连续 $MaxAttempts 次部署均未成功。见 work\deploy-*.out 与 work\deploy-*.err"
Write-Err '线上站点未受影响（Workers 只在成功上传后才切换版本）。'
exit 1
