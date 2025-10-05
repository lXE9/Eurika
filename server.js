/**
 * Express REST-API Server für IT-Problems Tracker
 * Supabase Cloud-Backend mit semantischer Suche
 */

import express from 'express';
import cors from 'cors';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { auditMiddleware } from './utils/auditService.js';
import supabaseRouter from './routes/supabase.js';
import monitoringRouter from './routes/monitoring.js';
import logger from './utils/logger.js';

// Server-Konfiguration
const PORT = process.env.PORT || 3000;
const app = express();

logger.info('🚀 Server startet...', { 
  meta: { 
    environment: process.env.NODE_ENV || 'development',
    port: PORT 
  } 
});

// Middleware (Reihenfolge ist wichtig!)
app.use(cors()); // CORS für Frontend-Integration
app.use(express.json({ limit: '10mb' })); // JSON Body Parser mit Limit
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // URL-encoded Body Parser
app.use(requestLogger); // Request-Logging & Metriken
app.use(auditMiddleware()); // Audit-Trail (User-Tracking)

// Monitoring & Health-Check Routes
app.use('/', monitoringRouter);

// API Info Endpoint
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'IT-Problems Tracker - Enterprise API mit semantischer Suche',
    version: '2.0.0',
    backend: 'Supabase PostgreSQL + pgvector',
    embeddingModel: 'all-MiniLM-L6-v2',
    features: [
      'Semantische Suche (all-MiniLM-L6-v2)',
      'Audit-Trail mit User-Tracking',
      'Performance-Monitoring',
      'Strukturiertes Logging',
      'Fehlerbehandlung',
      'Externe Quellen (Stack Overflow, YouTube)'
    ],
    endpoints: {
      problems: {
        'POST /api/problems': 'Problem mit automatischem Embedding erstellen',
        'GET /api/problems': 'Alle Probleme abrufen',
        'GET /api/problems/:id': 'Einzelnes Problem mit Lösungen abrufen',
        'PUT /api/problems/:id': 'Problem aktualisieren (Embedding wird automatisch neu generiert)',
        'DELETE /api/problems/:id': 'Problem löschen'
      },
      solutions: {
        'POST /api/solutions': 'Lösung zu Problem hinzufügen',
        'GET /api/problems/:id/solutions': 'Alle Lösungen für ein Problem'
      },
      search: {
        'POST /api/search': 'Semantische Suche (all-MiniLM-L6-v2 + Cosine-Similarity)',
        'POST /api/search/combined': 'Kombinierte Suche (Intern + Stack Overflow + YouTube)'
      },
      monitoring: {
        'GET /health': 'Detaillierter Health-Check',
        'GET /health/live': 'Liveness-Probe',
        'GET /health/ready': 'Readiness-Probe',
        'GET /metrics': 'Performance-Metriken (JSON)',
        'GET /metrics/prometheus': 'Prometheus-Format Metriken',
        'GET /status': 'System-Status Overview'
      }
    },
    documentation: 'Siehe SUPABASE_SETUP.md und API_EXAMPLES.md'
  });
});

// API Routes registrieren (Supabase als Haupt-API)
app.use('/api', supabaseRouter);

// 404 Handler für nicht existierende Routen
app.use(notFoundHandler);

// Error-Handling Middleware (muss als letztes registriert werden)
app.use(errorHandler);

// Server starten
const server = app.listen(PORT, () => {
  logger.info('✅ Server erfolgreich gestartet', {
    meta: {
      port: PORT,
      environment: process.env.NODE_ENV || 'development',
      endpoints: {
        api: `http://localhost:${PORT}/api`,
        health: `http://localhost:${PORT}/health`,
        metrics: `http://localhost:${PORT}/metrics`,
        status: `http://localhost:${PORT}/status`
      }
    }
  });
  
  console.log(`\n🚀 Server läuft auf http://localhost:${PORT}`);
  console.log(`📚 API-Dokumentation: http://localhost:${PORT}/api`);
  console.log(`💚 Health Check: http://localhost:${PORT}/health`);
  console.log(`📊 Metriken: http://localhost:${PORT}/metrics`);
  console.log(`🔍 Status: http://localhost:${PORT}/status`);
  console.log('\n✅ Bereit für Requests!\n');
});

// Graceful Shutdown
function gracefulShutdown(signal) {
  logger.warn(`${signal} empfangen, fahre Server herunter...`);
  
  server.close(() => {
    logger.info('✓ HTTP-Server geschlossen');
    logger.info('✅ Graceful Shutdown abgeschlossen');
    process.exit(0);
  });
  
  // Force shutdown nach 10 Sekunden
  setTimeout(() => {
    logger.error('⚠️ Konnte nicht graceful herunterfahren, erzwinge Shutdown');
    process.exit(1);
  }, 10000);
}

// Signal Handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled Promise Rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('❌ Unhandled Promise Rejection', { 
    meta: { reason, promise } 
  });
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Uncaught Exceptions
process.on('uncaughtException', (error) => {
  logger.error('❌ Uncaught Exception', { 
    meta: { error: error.message, stack: error.stack } 
  });
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

export default app;
