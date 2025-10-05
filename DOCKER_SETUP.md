# 🐳 Docker Setup - IT-Problems Tracker Backend

## 📋 Voraussetzungen

- Docker Desktop (Windows/Mac) oder Docker Engine (Linux)
- Docker Compose V2
- `.env` Datei mit Supabase-Credentials

## 🚀 Schnellstart

### 1. Container starten

```powershell
# Development-Modus (mit Logs)
docker-compose up

# Production-Modus (im Hintergrund)
docker-compose up -d
```

### 2. Logs ansehen

```powershell
# Alle Logs
docker-compose logs -f

# Nur Backend
docker-compose logs -f backend

# Letzte 100 Zeilen
docker-compose logs --tail=100 backend
```

### 3. Container stoppen

```powershell
# Stoppen (Container bleiben bestehen)
docker-compose stop

# Stoppen + Entfernen
docker-compose down

# Stoppen + Volumes löschen (Logs, Cache)
docker-compose down -v
```

---

## 🔧 Entwicklung

### Container neu bauen

```powershell
# Nach Code-Änderungen
docker-compose build

# Mit No-Cache (kompletter Rebuild)
docker-compose build --no-cache

# Rebuild + Start
docker-compose up --build
```

### In Container einloggen

```powershell
# Shell im laufenden Container
docker-compose exec backend sh

# Als Root (für Debugging)
docker-compose exec -u root backend sh
```

### Logs-Verzeichnis aufräumen

```powershell
# Logs im Container löschen
docker-compose exec backend sh -c "rm -rf logs/*.log"
```

---

## 📊 Monitoring & Health-Checks

### Status prüfen

```powershell
# Container-Status
docker-compose ps

# Health-Check Status
docker inspect eurika-backend --format='{{.State.Health.Status}}'
```

### API-Endpunkte testen

```powershell
# Health-Check (im Container)
docker-compose exec backend wget -qO- http://localhost:3000/health

# Von außen (Host)
Invoke-RestMethod http://localhost:3000/health
Invoke-RestMethod http://localhost:3000/metrics
Invoke-RestMethod http://localhost:3000/status
```

---

## 🔐 Environment-Variablen

### Erforderlich in `.env`:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
PORT=3000
NODE_ENV=production
```

### Überschreiben via docker-compose:

```yaml
environment:
  - NODE_ENV=development
  - PORT=8080
```

---

## 📦 Volumes

### Persistente Daten:

- **logs/** - Application-Logs (Host-mounted)
- **model-cache/** - Transformers.js Modell-Cache (Volume)

### Volume-Management:

```powershell
# Volumes auflisten
docker volume ls

# Modell-Cache löschen (für Neudownload)
docker volume rm eurika_model-cache

# Alle Volumes löschen
docker-compose down -v
```

---

## 🌐 Networking

### Standard-Ports:

- **Backend:** `localhost:3000`
- **Redis:** `localhost:6379` (wenn aktiviert)

### Custom-Port verwenden:

```yaml
# docker-compose.yaml
ports:
  - "8080:3000"  # Host:Container
```

Dann: `http://localhost:8080`

---

## 🚢 Production-Deployment

### Docker Image builden

```powershell
# Image bauen
docker build -t eurika-backend:2.0.0 .

# Mit Tag
docker build -t your-registry.com/eurika-backend:latest .
```

### Image pushen (z.B. Docker Hub)

```powershell
# Login
docker login

# Tag erstellen
docker tag eurika-backend:latest your-username/eurika-backend:latest

# Push
docker push your-username/eurika-backend:latest
```

### Auf Server deployen

```powershell
# 1. .env-Datei auf Server kopieren
scp .env user@server:/app/.env

# 2. docker-compose.yaml kopieren
scp docker-compose.yaml user@server:/app/

# 3. Auf Server: Container starten
ssh user@server
cd /app
docker-compose pull
docker-compose up -d
```

---

## 🐞 Debugging

### Container läuft nicht?

```powershell
# Logs ansehen
docker-compose logs backend

# Exit-Code prüfen
docker-compose ps

# Health-Check-Details
docker inspect eurika-backend | grep -A 10 Health
```

### "Cannot connect to Supabase"?

```powershell
# Environment prüfen
docker-compose exec backend env | grep SUPABASE

# Netzwerk testen
docker-compose exec backend wget -qO- https://your-project.supabase.co
```

### Modell lädt nicht?

```powershell
# Cache löschen
docker volume rm eurika_model-cache
docker-compose up -d

# Logs beobachten
docker-compose logs -f backend | grep "Modell"
```

---

## 📈 Performance-Optimierung

### Resource-Limits anpassen

```yaml
# docker-compose.yaml
deploy:
  resources:
    limits:
      cpus: '2'      # 2 CPU-Cores
      memory: 2G     # 2GB RAM
```

### Multi-Stage Build für kleineres Image

```dockerfile
# Bereits implementiert in Dockerfile!
# Image-Größe: ~350MB statt ~1GB
```

---

## 🔄 Updates & Maintenance

### Backend aktualisieren

```powershell
# 1. Code pullen
git pull

# 2. Neu bauen
docker-compose build

# 3. Neu starten (ohne Downtime)
docker-compose up -d --no-deps --build backend
```

### Logs rotieren

```powershell
# In docker-compose.yaml bereits konfiguriert:
logging:
  options:
    max-size: "10m"
    max-file: "3"
# = Max. 30MB Logs pro Container
```

---

## ⚙️ Kubernetes-Ready

### Health-Checks für K8s:

```yaml
# kubernetes/deployment.yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
```

---

## 🎯 Cheat-Sheet

```powershell
# Starten
docker-compose up -d

# Stoppen
docker-compose down

# Neu bauen
docker-compose build

# Logs
docker-compose logs -f

# In Container
docker-compose exec backend sh

# Status
docker-compose ps

# Aufräumen
docker-compose down -v
docker system prune -a
```

---

## 📞 Troubleshooting

| Problem | Lösung |
|---------|--------|
| Port 3000 belegt | `docker-compose down` oder Port in compose ändern |
| Supabase-Fehler | `.env` prüfen, Credentials korrekt? |
| Modell lädt nicht | Cache löschen: `docker volume rm eurika_model-cache` |
| Container startet nicht | `docker-compose logs backend` ansehen |
| Hoher RAM-Verbrauch | Resource-Limits setzen (siehe oben) |

---

## ✅ Production-Checklist

- [ ] `.env` mit Production-Credentials
- [ ] `NODE_ENV=production` gesetzt
- [ ] Health-Checks funktionieren
- [ ] Logs werden rotiert
- [ ] Resource-Limits konfiguriert
- [ ] Monitoring aktiviert (Prometheus?)
- [ ] Backups eingerichtet (Supabase)
- [ ] SSL/TLS konfiguriert (Reverse-Proxy)

---

**Dein Backend ist jetzt Docker-ready!** 🚀
