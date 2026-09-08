$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$backendPath = Join-Path $taskRoot 'backend'
$wranglerPath = Join-Path $backendPath 'node_modules/wrangler/bin/wrangler.js'
$nodePath = (Get-Command node -ErrorAction Stop).Source
if (-not (Test-Path -LiteralPath $wranglerPath)) { throw 'Installed Wrangler is missing.' }
Write-Host 'Target: bulao-api-staging / MSG91_AUTH_KEY. Production is not accessed.'
$replacement = Read-Host 'Paste the NEW MSG91 AuthKey (input hidden)' -AsSecureString
if ($replacement.Length -eq 0) { throw 'No key supplied.' }
$start = [System.Diagnostics.ProcessStartInfo]::new()
$start.FileName = $nodePath
$start.WorkingDirectory = $backendPath
$start.UseShellExecute = $false
$start.CreateNoWindow = $true
$start.RedirectStandardInput = $true
$start.RedirectStandardOutput = $true
$start.RedirectStandardError = $true
foreach ($argument in @($wranglerPath, 'secret', 'put', 'MSG91_AUTH_KEY', '--env', 'staging')) { $start.ArgumentList.Add($argument) }
$start.Environment['WRANGLER_SEND_METRICS'] = 'false'
$process = [System.Diagnostics.Process]::new()
$process.StartInfo = $start
$secretPointer = [IntPtr]::Zero
try {
  if (-not $process.Start()) { throw 'Could not start Wrangler.' }
  $stdout = $process.StandardOutput.ReadToEndAsync()
  $stderr = $process.StandardError.ReadToEndAsync()
  $secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($replacement)
  $process.StandardInput.WriteLine([Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer))
  $process.StandardInput.Close()
  $process.WaitForExit()
  # Discard CLI output rather than risking echoing provider credentials.
  $null = $stdout.GetAwaiter().GetResult()
  $null = $stderr.GetAwaiter().GetResult()
  if ($process.ExitCode -ne 0) { throw 'Staging secret update failed. Check Cloudflare sign-in; no credentials have been printed.' }
  Write-Host 'Staging MSG91_AUTH_KEY updated successfully. Reply in Codex so staging verification can continue.'
} finally {
  if ($secretPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer) }
  $replacement.Dispose()
  $process.Dispose()
}
