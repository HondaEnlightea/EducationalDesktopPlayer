$ErrorActionPreference = 'Stop'
$applicationRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
function AppPath([string]$relative) {
 $resolved = [IO.Path]::GetFullPath((Join-Path $applicationRoot $relative))
 if (-not $resolved.StartsWith($applicationRoot + '\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Path outside application root' }
 return $resolved
}
function MovePackage([string]$source,[string]$destination) {
 foreach ($target in @($source,$destination)) { if (-not $target.StartsWith($applicationRoot + '\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid package move' } }
 for ($attempt=0; $attempt -lt 8; $attempt++) {
  try { [IO.Directory]::Move($source,$destination); return }
  catch [IO.IOException] { if ($attempt -eq 7) { throw }; Start-Sleep -Milliseconds 750 }
 }
}
$package = AppPath 'release/win-unpacked'
$staged = AppPath 'release-next/win-unpacked'
$executable = AppPath 'release/win-unpacked/Educational Desktop Player.exe'
Set-Location -LiteralPath $applicationRoot
# Build separately so the regular launcher only sees a completed package.
npm run package -- --config.directories.output=release-next
if ($LASTEXITCODE -ne 0) { throw 'Staged Windows package failed; current data and launcher are unchanged' }
if (-not (Test-Path -LiteralPath (Join-Path $staged 'Educational Desktop Player.exe'))) { throw 'Staged executable missing' }
$stamp = [DateTimeOffset]::UtcNow.ToOffset([TimeSpan]::FromHours(9)).ToString('yyyyMMdd-HHmmss')
$backup = AppPath ('.backups/update-' + $stamp)
New-Item -ItemType Directory -Path $backup -Force | Out-Null
# Stop only processes executing this app's previous binary.
$running = @(Get-CimInstance Win32_Process -Filter "Name = 'Educational Desktop Player.exe'" | Where-Object { $_.ExecutablePath -eq $executable })
foreach ($applicationProcess in $running) {
 $fresh = Get-CimInstance Win32_Process -Filter "ProcessId = $($applicationProcess.ProcessId)"
 if ($fresh -and $fresh.ExecutablePath -eq $executable) {
  Stop-Process -Id $fresh.ProcessId
  $remaining = Get-Process -Id $fresh.ProcessId -ErrorAction SilentlyContinue
  if ($remaining) { $remaining.WaitForExit(5000) | Out-Null }
 }
}
$data = AppPath 'data'
if (Test-Path -LiteralPath $data) {
 Copy-Item -LiteralPath $data -Destination (Join-Path $backup 'data') -Recurse
 foreach ($file in @('history.json','settings.json')) {
  $original = Join-Path $data $file
  if (Test-Path -LiteralPath $original) {
   if ((Get-FileHash -LiteralPath $original).Hash -ne (Get-FileHash -LiteralPath (Join-Path $backup ('data/' + $file))).Hash) { throw 'Backup checksum differs' }
  }
 }
 Write-Output "Saved app data backup: $backup"
}
$previousPackage = Join-Path $backup 'previous-windows'
$hadPrevious = Test-Path -LiteralPath $package
if ($hadPrevious) { MovePackage $package $previousPackage }
try { MovePackage $staged $package }
catch {
 if ($hadPrevious -and -not (Test-Path -LiteralPath $package)) { MovePackage $previousPackage $package }
 throw
}
Write-Output 'Updated release/win-unpacked after staged build. Existing launcher paths are unchanged.'
