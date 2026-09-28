$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$backendPath = Join-Path $taskRoot 'backend'
$wranglerPath = Join-Path $backendPath 'node_modules/wrangler/bin/wrangler.js'
$nodePath = (Get-Command node -ErrorAction Stop).Source

if (-not (Test-Path -LiteralPath $wranglerPath)) { throw 'Installed Wrangler is missing.' }

Write-Host 'Target: bulao-api-staging / Setting Cloudinary Secrets...'

$secrets = @{
    'CLOUDINARY_API_SECRET' = 'sOYaJw5HZTIQ5Bmj1tKaIuZbgys'
}

foreach ($key in $secrets.Keys) {
    $val = $secrets[$key]
    Write-Host "Updating staging secret: $key..."
    
    $start = [System.Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $nodePath
    $start.WorkingDirectory = $backendPath
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardInput = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    foreach ($argument in @($wranglerPath, 'secret', 'put', $key, '--env', 'staging')) { $start.ArgumentList.Add($argument) }
    $start.Environment['WRANGLER_SEND_METRICS'] = 'false'
    
    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $start
    if (-not $process.Start()) { throw "Could not start Wrangler for $key." }
    
    $process.StandardInput.WriteLine($val)
    $process.StandardInput.Close()
    $process.WaitForExit()
    
    if ($process.ExitCode -ne 0) {
        $err = $process.StandardError.ReadToEnd()
        Write-Host "Failed to set ${key}: ${err}"
    } else {
        Write-Host "Successfully updated ${key} in Cloudflare staging!"
    }
    $process.Dispose()
}
