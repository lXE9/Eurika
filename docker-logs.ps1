# =====================================================
# Docker Logs Script
# Zeigt Container-Logs an
# =====================================================

Write-Host "`n🐳 IT-Problems Tracker - Docker Logs`n" -ForegroundColor Cyan
Write-Host "📋 Zeige Backend-Logs (Ctrl+C zum Beenden):`n" -ForegroundColor Yellow

docker-compose logs -f --tail=100 backend
