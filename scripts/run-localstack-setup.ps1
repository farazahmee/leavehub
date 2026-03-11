# LocalStack setup script for Windows 10
# Usage: .\scripts\run-localstack-setup.ps1
# Prerequisites: Docker Desktop running, backend\.env has AWS_S3_* set for LocalStack

param(
    [switch]$SkipBucket,   # Skip bucket creation (only start LocalStack)
    [int]$WaitSeconds = 30 # Max seconds to wait for LocalStack health
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BackendDir = Join-Path $ProjectRoot "backend"

Write-Host "=== LocalStack Setup (Windows) ===" -ForegroundColor Cyan
Write-Host "Project root: $ProjectRoot"
Write-Host ""

# Step 1: Check Docker
Write-Host "[1/4] Checking Docker..." -ForegroundColor Yellow
try {
    $null = docker info 2>&1
    Write-Host "  Docker is running." -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Docker is not running. Start Docker Desktop and try again." -ForegroundColor Red
    exit 1
}

# Step 2: Start LocalStack
Write-Host ""
Write-Host "[2/4] Starting LocalStack container..." -ForegroundColor Yellow
Push-Location $ProjectRoot
try {
    docker compose -f docker-compose.localstack.yml up -d
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ERROR: Failed to start LocalStack." -ForegroundColor Red
        exit 1
    }
    Write-Host "  LocalStack started." -ForegroundColor Green
} finally {
    Pop-Location
}

# Step 3: Wait for LocalStack health
Write-Host ""
Write-Host "[3/4] Waiting for LocalStack to be ready..." -ForegroundColor Yellow
$healthUrl = "http://127.0.0.1:4566/_localstack/health"
$elapsed = 0
$healthy = $false
while ($elapsed -lt $WaitSeconds) {
    try {
        $response = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 3 -ErrorAction SilentlyContinue
        if ($response) {
            $healthy = $true
            break
        }
    } catch {
        Start-Sleep -Seconds 2
        $elapsed += 2
    }
}
if (-not $healthy) {
    Write-Host "  WARNING: LocalStack health check timed out after ${WaitSeconds}s." -ForegroundColor Yellow
    Write-Host "  You can still try creating the bucket manually. Endpoint: $healthUrl" -ForegroundColor Gray
} else {
    Write-Host "  LocalStack is ready." -ForegroundColor Green
}

# Step 4: Create bucket (unless -SkipBucket)
if (-not $SkipBucket) {
    Write-Host ""
    Write-Host "[4/4] Creating S3 bucket (via backend script)..." -ForegroundColor Yellow
    Push-Location $BackendDir
    try {
        python -m scripts.create_localstack_bucket
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  Bucket created successfully." -ForegroundColor Green
        } else {
            Write-Host "  Bucket creation failed. Ensure backend\.env has:" -ForegroundColor Yellow
            Write-Host "    AWS_S3_BUCKET_NAME=workforcehub-uploads" -ForegroundColor Gray
            Write-Host "    AWS_S3_ENDPOINT_URL=http://127.0.0.1:4566" -ForegroundColor Gray
        }
    } catch {
        Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "  Make sure backend\.env has AWS_S3_BUCKET_NAME and AWS_S3_ENDPOINT_URL set." -ForegroundColor Yellow
    } finally {
        Pop-Location
    }
} else {
    Write-Host ""
    Write-Host "[4/4] Skipping bucket creation (-SkipBucket)." -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Cyan
Write-Host "LocalStack S3 endpoint: http://127.0.0.1:4566"
Write-Host "Next: Restart backend if it was running, then test document/payroll uploads."
Write-Host ""
