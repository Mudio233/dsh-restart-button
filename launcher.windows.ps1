# Restart launcher for DeepSeek Harness (Windows).
# The plugin substitutes {{EXE}} and {{LOG}} at request time. The pause before
# the kill is set here, and this file is read on every restart, so editing it
# applies immediately without restarting the Host. Every step is logged: the
# launcher runs without a console, so the log is the only evidence afterwards.
# Keep this file small: the payload travels inside one cmd line (8191 chars).

$ErrorActionPreference = 'SilentlyContinue'
$exe = '{{EXE}}'
$log = '{{LOG}}'
$directory = Split-Path -Parent $exe

function Note([string]$text) {
  try {
    Add-Content -LiteralPath $log -Value ('{0:yyyy-MM-dd HH:mm:ss.fff} {1}' -f (Get-Date), $text) -Encoding UTF8
  } catch {
    # A log that cannot be written must not stop the restart.
  }
}

if (Test-Path -LiteralPath $log) {
  if ((Get-Item -LiteralPath $log).Length -gt 65536) { Remove-Item -LiteralPath $log -Force }
}

Note ("start: pid={0} nodeMode={1} exe={2}" -f $PID, $env:ELECTRON_RUN_AS_NODE, $exe)
# Only long enough for the accepted HTTP response to reach the page.
Start-Sleep -Milliseconds 400

$running = @(Get-Process | Where-Object { $_.Path -eq $exe })
Note ("ending {0}: {1}" -f $running.Count, (($running | ForEach-Object { $_.Id }) -join ','))
$running | Stop-Process -Force

# Wait for them to really leave, so the next start meets no leftovers.
for ($i = 0; $i -lt 40; $i++) {
  Start-Sleep -Milliseconds 250
  if (@(Get-Process | Where-Object { $_.Path -eq $exe }).Count -eq 0) { break }
}
$left = @(Get-Process | Where-Object { $_.Path -eq $exe })
Note ("wait done, left: {0}" -f $left.Count)
if ($left.Count -gt 0) { $left | Stop-Process -Force; Start-Sleep -Milliseconds 500 }

# The Host is this exe in Electron's Node mode, so a child started with this
# variable runs as a windowless Node and exits at once.
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
Remove-Item Env:ELECTRON_NO_ATTACH_CONSOLE -ErrorAction SilentlyContinue
Note ("nodeMode after clear: [{0}]" -f $env:ELECTRON_RUN_AS_NODE)

$started = $null
try {
  $started = Start-Process -FilePath $exe -WorkingDirectory $directory -PassThru
  Note ("started: pid={0}" -f $started.Id)
} catch {
  Note ("start failed: {0}" -f $_.Exception.Message)
}

Start-Sleep -Seconds 8
$now = @(Get-Process | Where-Object { $_.Path -eq $exe })
Note ("after 8s: {0} alive" -f $now.Count)
if ($now.Count -eq 0) {
  try {
    $retry = Start-Process -FilePath $exe -WorkingDirectory $directory -PassThru
    Note ("retried: pid={0}" -f $retry.Id)
  } catch {
    Note ("retry failed: {0}" -f $_.Exception.Message)
  }
  Start-Sleep -Seconds 5
  Note ("after retry: {0} alive" -f @(Get-Process | Where-Object { $_.Path -eq $exe }).Count)
}
Note 'done'
