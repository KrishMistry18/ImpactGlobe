# Initialize all forex pairs
# This script calls the /api/forex/init endpoint to fetch all 5 pairs at once

# Read admin secret from .env.local
$envFile = Get-Content .env.local
$adminSecret = ($envFile | Select-String "ADMIN_SECRET=(.+)").Matches.Groups[1].Value

if (-not $adminSecret) {
    Write-Host "ERROR: ADMIN_SECRET not found in .env.local" -ForegroundColor Red
    exit 1
}

Write-Host "Initializing all forex pairs..." -ForegroundColor Cyan
Write-Host "This will take about 1-2 minutes..." -ForegroundColor Yellow
Write-Host ""

$headers = @{
    "x-admin-secret" = $adminSecret
}

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/forex/init" -Headers $headers -Method Get
    
    Write-Host "SUCCESS!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Initialized pairs:" -ForegroundColor Cyan
    
    foreach ($pair in $response.initialized) {
        $color = if ($pair.changePercent24h -gt 0) { "Green" } else { "Red" }
        Write-Host "  $($pair.pair): $($pair.currentPrice) ($($pair.changePercent24h)%)" -ForegroundColor $color
    }
    
    Write-Host ""
    Write-Host "Stats:" -ForegroundColor Cyan
    Write-Host "  Total pairs: $($response.stats.totalPairs)"
    Write-Host "  Successful: $($response.stats.successfulPairs)"
    Write-Host "  Failed: $($response.stats.failedPairs)"
    Write-Host "  API credits used: $($response.stats.apiCreditsUsed)"
    
    if ($response.errors) {
        Write-Host ""
        Write-Host "Errors:" -ForegroundColor Red
        foreach ($error in $response.errors) {
            Write-Host "  $($error.pair): $($error.error)" -ForegroundColor Red
        }
    }
    
    Write-Host ""
    Write-Host "Refresh your browser to see all pairs in the Top Movers panel!" -ForegroundColor Green
    
} catch {
    Write-Host "ERROR: Failed to initialize forex pairs" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
