/**
 * Monitoring & Health-Check Endpunkte
 * Für Kubernetes, Docker, Load-Balancer
 */

import express from 'express';
import { getMetrics, getPrometheusMetrics, resetMetrics } from '../utils/metrics.js';
import { supabase } from '../supabaseClient.js';
import { getModelInfo } from '../embeddingService.js';

const router = express.Router();

/**
 * GET /health/live
 * Liveness-Probe (ist der Server am Leben?)
 */
router.get('/health/live', (req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /health/ready
 * Readiness-Probe (ist der Server bereit für Requests?)
 */
router.get('/health/ready', async (req, res) => {
  const checks = {
    server: 'ok',
    database: 'unknown',
    embeddingModel: 'unknown'
  };
  
  let allOk = true;
  
  // Supabase-Verbindung prüfen
  try {
    const { error } = await supabase
      .from('problems')
      .select('id')
      .limit(1);
    
    checks.database = error ? 'error' : 'ok';
    if (error) allOk = false;
  } catch (error) {
    checks.database = 'error';
    allOk = false;
  }
  
  // Embedding-Modell prüfen
  try {
    const modelInfo = getModelInfo();
    checks.embeddingModel = modelInfo.loaded ? 'ok' : 'not_loaded';
    // Nicht geladen ist OK, wird bei Bedarf geladen
  } catch (error) {
    checks.embeddingModel = 'error';
  }
  
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ready' : 'not_ready',
    checks,
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /health
 * Detaillierter Health-Check
 */
router.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    backend: 'supabase-cloud',
    version: '2.0.0',
    checks: {}
  };
  
  // Supabase-Verbindung
  try {
    const startTime = Date.now();
    const { data, error } = await supabase
      .from('problems')
      .select('id')
      .limit(1);
    
    health.checks.database = {
      status: error ? 'unhealthy' : 'healthy',
      responseTime: Date.now() - startTime,
      ...(error && { error: error.message })
    };
    
    if (error) health.status = 'unhealthy';
  } catch (error) {
    health.checks.database = {
      status: 'unhealthy',
      error: error.message
    };
    health.status = 'unhealthy';
  }
  
  // Embedding-Modell
  try {
    const modelInfo = getModelInfo();
    health.checks.embeddingModel = {
      status: 'healthy',
      loaded: modelInfo.loaded,
      name: modelInfo.name,
      dimensions: modelInfo.dimensions
    };
  } catch (error) {
    health.checks.embeddingModel = {
      status: 'unhealthy',
      error: error.message
    };
  }
  
  // Memory
  const memUsage = process.memoryUsage();
  health.checks.memory = {
    status: memUsage.heapUsed < memUsage.heapTotal * 0.9 ? 'healthy' : 'warning',
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
    usage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100) + '%'
  };
  
  res.status(health.status === 'healthy' ? 200 : 503).json(health);
});

/**
 * GET /metrics
 * Performance-Metriken (JSON)
 */
router.get('/metrics', (req, res) => {
  const metrics = getMetrics();
  res.json(metrics);
});

/**
 * GET /metrics/prometheus
 * Prometheus-Format Metriken
 */
router.get('/metrics/prometheus', (req, res) => {
  const metrics = getPrometheusMetrics();
  res.set('Content-Type', 'text/plain; version=0.0.4');
  res.send(metrics);
});

/**
 * POST /metrics/reset
 * Metriken zurücksetzen (nur in Development)
 */
router.post('/metrics/reset', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      error: 'Nicht erlaubt in Production'
    });
  }
  
  resetMetrics();
  res.json({
    success: true,
    message: 'Metriken zurückgesetzt'
  });
});

/**
 * GET /status
 * System-Status Overview
 */
router.get('/status', (req, res) => {
  const metrics = getMetrics();
  const modelInfo = getModelInfo();
  
  res.json({
    server: {
      status: 'running',
      uptime: metrics.uptime.human,
      version: '2.0.0',
      environment: process.env.NODE_ENV || 'development'
    },
    backend: {
      type: 'Supabase PostgreSQL + pgvector',
      embeddingModel: modelInfo.name,
      embeddingDimensions: modelInfo.dimensions,
      modelLoaded: modelInfo.loaded
    },
    performance: {
      requests: {
        total: metrics.requests.total,
        successRate: metrics.requests.successRate
      },
      responseTime: metrics.performance.responseTime,
      embeddings: {
        generated: metrics.embeddings.generated,
        avgTime: metrics.embeddings.avgGenerationTime
      }
    },
    timestamp: new Date().toISOString()
  });
});

export default router;
