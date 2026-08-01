$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$configPath = Join-Path $root "frontend\src-tauri\tauri.conf.json"
$config = Get-Content $configPath -Raw | ConvertFrom-Json
$version = [string]$config.version
$output = Join-Path $root "release\Bolty-Switch-v$version"

if (Test-Path $output) { Remove-Item $output -Recurse -Force }
New-Item -ItemType Directory -Path $output | Out-Null

$bundleRoot = Join-Path $root "frontend\src-tauri\target\release\bundle"
$artifacts = @()
if (Test-Path $bundleRoot) {
  $artifacts = Get-ChildItem $bundleRoot -Recurse -File | Where-Object { $_.Extension -in '.exe', '.msi' }
}
if (-not $artifacts) {
  throw "No se encontraron instaladores en $bundleRoot"
}

foreach ($artifact in $artifacts) {
  Copy-Item $artifact.FullName (Join-Path $output $artifact.Name)
}

$checksums = foreach ($file in Get-ChildItem $output -File) {
  $hash = Get-FileHash $file.FullName -Algorithm SHA256
  "$($hash.Hash.ToLowerInvariant())  $($file.Name)"
}
$checksums | Set-Content (Join-Path $output "SHA256SUMS.txt") -Encoding UTF8

Write-Host "Release preparada en: $output"
Get-ChildItem $output | Format-Table Name, Length
