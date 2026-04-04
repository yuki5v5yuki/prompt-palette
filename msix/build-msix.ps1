<#
.SYNOPSIS
  Tauri の MSI ビルド成果物から MSIX パッケージを生成する
.DESCRIPTION
  1. MSI を展開
  2. AppxManifest.xml + Assets をコピー
  3. makeappx.exe で MSIX にパッケージング
.PARAMETER MsiPath
  入力 MSI ファイルのパス
.PARAMETER OutputPath
  出力 MSIX ファイルのパス
.PARAMETER Version
  パッケージバージョン (例: 0.1.0.0)
.PARAMETER Publisher
  Publisher 値 (Partner Center で取得後に設定)
#>
param(
    [Parameter(Mandatory=$true)]
    [string]$MsiPath,

    [Parameter(Mandatory=$false)]
    [string]$OutputPath = "PromptPalette.msix",

    [Parameter(Mandatory=$false)]
    [string]$Version = "0.1.0.0",

    [Parameter(Mandatory=$false)]
    [string]$Publisher = "CN=PromptPalette"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$WorkDir = Join-Path $env:TEMP "msix-build-$(Get-Random)"

Write-Host "=== MSIX Build Script ===" -ForegroundColor Cyan

# 1. MSI を展開
Write-Host "[1/4] Extracting MSI..." -ForegroundColor Yellow
$ExtractDir = Join-Path $WorkDir "extracted"
New-Item -ItemType Directory -Force -Path $ExtractDir | Out-Null
$MsiFullPath = Resolve-Path $MsiPath
Start-Process msiexec -ArgumentList "/a `"$MsiFullPath`" /qn TARGETDIR=`"$ExtractDir`"" -Wait -NoNewWindow

# 2. MSIX コンテンツを構成
Write-Host "[2/4] Preparing MSIX content..." -ForegroundColor Yellow
$MsixContent = Join-Path $WorkDir "msix-content"
New-Item -ItemType Directory -Force -Path $MsixContent | Out-Null

# exe と関連ファイルをコピー（WebView2Loader.dll 等も含む）
Get-ChildItem -Path $ExtractDir -Recurse -File | Where-Object {
    $_.Extension -in '.exe', '.dll'
} | ForEach-Object {
    Copy-Item $_.FullName -Destination $MsixContent
}

# Tauri のリソースファイルもコピー（存在する場合）
$ResourceDirs = Get-ChildItem -Path $ExtractDir -Recurse -Directory -ErrorAction SilentlyContinue
foreach ($dir in $ResourceDirs) {
    if ($dir.Name -eq "_up_") { continue }
    $files = Get-ChildItem -Path $dir.FullName -File -ErrorAction SilentlyContinue
    foreach ($f in $files) {
        if ($f.Extension -notin '.exe', '.dll', '.msi') {
            $dest = Join-Path $MsixContent $f.Name
            if (-not (Test-Path $dest)) {
                Copy-Item $f.FullName -Destination $dest
            }
        }
    }
}

# Assets をコピー
$AssetsSource = Join-Path $ScriptDir "Assets"
$AssetsDest = Join-Path $MsixContent "Assets"
Copy-Item -Path $AssetsSource -Destination $AssetsDest -Recurse

# AppxManifest.xml をコピー＆バージョン/Publisher を置換
$ManifestSource = Join-Path $ScriptDir "AppxManifest.xml"
$ManifestDest = Join-Path $MsixContent "AppxManifest.xml"
$manifestContent = Get-Content $ManifestSource -Raw
$manifestContent = $manifestContent -replace 'Version="[^"]*"', "Version=`"$Version`""
$manifestContent = $manifestContent -replace 'Publisher="[^"]*"', "Publisher=`"$Publisher`""
Set-Content -Path $ManifestDest -Value $manifestContent -Encoding UTF8

# 3. makeappx.exe でパッケージング
Write-Host "[3/4] Creating MSIX package..." -ForegroundColor Yellow

# Windows SDK の makeappx.exe を探す
$sdkPaths = Get-ChildItem "C:\Program Files (x86)\Windows Kits\10\bin\10.*\x64\makeappx.exe" -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending
if ($sdkPaths.Count -eq 0) {
    Write-Error "makeappx.exe not found. Please install Windows SDK."
    exit 1
}
$makeappx = $sdkPaths[0].FullName
Write-Host "  Using: $makeappx"

$OutputFullPath = Join-Path (Get-Location) $OutputPath
& $makeappx pack /d $MsixContent /p $OutputFullPath /o

if ($LASTEXITCODE -ne 0) {
    Write-Error "makeappx failed with exit code $LASTEXITCODE"
    exit 1
}

# 4. クリーンアップ
Write-Host "[4/4] Cleaning up..." -ForegroundColor Yellow
Remove-Item -Recurse -Force $WorkDir

Write-Host "=== Done! ===" -ForegroundColor Green
Write-Host "Output: $OutputFullPath"
