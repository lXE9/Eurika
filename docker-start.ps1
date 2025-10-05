# =====================================================
# Docker Start Script
# Startet den Backend-Container
# =====================================================

Write-Host "`n🐳 IT-Problems Tracker - Docker Start`n" -ForegroundColor Cyan

# .env prüfen
if (-not (Test-Path ".env")) {
    Write-Host "❌ Fehler: .env Datei nicht gefunden!" -ForegroundColor Red
    Write-Host "   Erstelle .env mit SUPABASE_URL und SUPABASE_KEY`n" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ .env gefunden" -ForegroundColor Green

# Docker prüfen
try {
    docker --version | Out-Null
    Write-Host "✓ Docker installiert" -ForegroundColor Green
} catch {
    Write-Host "❌ Fehler: Docker nicht gefunden!" -ForegroundColor Red
    Write-Host "   Installiere Docker Desktop: https://www.docker.com/products/docker-desktop`n" -ForegroundColor Yellow
    exit 1
}

# Container starten
Write-Host "`n🚀 Starte Container...`n" -ForegroundColor Cyan
docker-compose up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Container erfolgreich gestartet!`n" -ForegroundColor Green
    
    # Warte auf Health-Check
    Write-Host "⏳ Warte auf Health-Check (max. 40 Sekunden)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    
    # Status prüfen
    docker-compose ps
    
    Write-Host "`n📊 Verfügbare Endpunkte:" -ForegroundColor Cyan
    Write-Host "   API:     http://localhost:3000/api" -ForegroundColor White
    Write-Host "   Health:  http://localhost:3000/health" -ForegroundColor White
    Write-Host "   Metrics: http://localhost:3000/metrics" -ForegroundColor White
    Write-Host "   Status:  http://localhost:3000/status" -ForegroundColor White
    
    Write-Host "`n📋 Nützliche Befehle:" -ForegroundColor Cyan
    Write-Host "   Logs ansehen:  docker-compose logs -f" -ForegroundColor White
    Write-Host "   Stoppen:       docker-compose down" -ForegroundColor White
    Write-Host "   Neu starten:   docker-compose restart`n" -ForegroundColor White
    
} else {
    Write-Host "`n❌ Fehler beim Starten der Container!" -ForegroundColor Red
    Write-Host "   Logs ansehen: docker-compose logs`n" -ForegroundColor Yellow
    exit 1
}
