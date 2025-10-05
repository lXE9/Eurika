# =====================================================
# Docker Stop Script
# Stoppt den Backend-Container
# =====================================================

Write-Host "`n🐳 IT-Problems Tracker - Docker Stop`n" -ForegroundColor Cyan

Write-Host "🛑 Stoppe Container...`n" -ForegroundColor Yellow
docker-compose down

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Container erfolgreich gestoppt!`n" -ForegroundColor Green
} else {
    Write-Host "`n❌ Fehler beim Stoppen der Container!`n" -ForegroundColor Red
    exit 1
}
