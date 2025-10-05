/**
 * Performance-Metriken und Monitoring
 * Sammelt Statistiken über API-Nutzung
 */

// Metriken-Speicher (In-Memory, für Production: Redis verwenden)
const metrics = {
  requests: {
    total: 0,
    success: 0,
    errors: 0,
    byMethod: {},
    byEndpoint: {}
  },
  responseTime: {
    min: Infinity,
    max: 0,
    avg: 0,
    samples: []
  },
  embeddings: {
    generated: 0,
    totalTime: 0,
    avgTime: 0
  },
  searches: {
    total: 0,
    avgResultCount: 0,
    avgResponseTime: 0
  },
  errors: {
    total: 0,
    by4xx: 0,
    by5xx: 0,
    byType: {}
  },
  startTime: Date.now()
};

/**
 * Request-Metrik erfassen
 */
export function recordRequest(method, endpoint, statusCode, responseTime) {
  metrics.requests.total++;
  
  if (statusCode < 400) {
    metrics.requests.success++;
  } else {
    metrics.requests.errors++;
    metrics.errors.total++;
    
    if (statusCode >= 400 && statusCode < 500) {
      metrics.errors.by4xx++;
    } else if (statusCode >= 500) {
      metrics.errors.by5xx++;
    }
  }
  
  // Nach Methode
  metrics.requests.byMethod[method] = (metrics.requests.byMethod[method] || 0) + 1;
  
  // Nach Endpoint
  const cleanEndpoint = endpoint.replace(/\/[a-f0-9-]{36}/g, '/:id'); // UUIDs ersetzen
  metrics.requests.byEndpoint[cleanEndpoint] = (metrics.requests.byEndpoint[cleanEndpoint] || 0) + 1;
  
  // Response-Time
  recordResponseTime(responseTime);
}

/**
 * Response-Time erfassen
 */
function recordResponseTime(time) {
  metrics.responseTime.min = Math.min(metrics.responseTime.min, time);
  metrics.responseTime.max = Math.max(metrics.responseTime.max, time);
  
  // Rolling Average (letzte 100 Samples)
  metrics.responseTime.samples.push(time);
  if (metrics.responseTime.samples.length > 100) {
    metrics.responseTime.samples.shift();
  }
  
  const sum = metrics.responseTime.samples.reduce((a, b) => a + b, 0);
  metrics.responseTime.avg = Math.round(sum / metrics.responseTime.samples.length);
}

/**
 * Embedding-Generierung erfassen
 */
export function recordEmbedding(duration) {
  metrics.embeddings.generated++;
  metrics.embeddings.totalTime += duration;
  metrics.embeddings.avgTime = Math.round(metrics.embeddings.totalTime / metrics.embeddings.generated);
}

/**
 * Suche erfassen
 */
export function recordSearch(resultCount, responseTime) {
  metrics.searches.total++;
  const prevTotal = metrics.searches.total - 1;
  
  // Rolling Average
  metrics.searches.avgResultCount = Math.round(
    (metrics.searches.avgResultCount * prevTotal + resultCount) / metrics.searches.total
  );
  
  metrics.searches.avgResponseTime = Math.round(
    (metrics.searches.avgResponseTime * prevTotal + responseTime) / metrics.searches.total
  );
}

/**
 * Fehler erfassen
 */
export function recordError(errorType) {
  metrics.errors.byType[errorType] = (metrics.errors.byType[errorType] || 0) + 1;
}

/**
 * Alle Metriken abrufen
 */
export function getMetrics() {
  const uptime = Date.now() - metrics.startTime;
  const uptimeHours = Math.floor(uptime / (1000 * 60 * 60));
  const uptimeMinutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
  
  return {
    uptime: {
      ms: uptime,
      human: `${uptimeHours}h ${uptimeMinutes}m`
    },
    requests: {
      total: metrics.requests.total,
      success: metrics.requests.success,
      errors: metrics.requests.errors,
      successRate: metrics.requests.total > 0 
        ? ((metrics.requests.success / metrics.requests.total) * 100).toFixed(2) + '%'
        : 'N/A',
      byMethod: metrics.requests.byMethod,
      byEndpoint: Object.entries(metrics.requests.byEndpoint)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10) // Top 10
        .reduce((obj, [key, val]) => ({ ...obj, [key]: val }), {})
    },
    performance: {
      responseTime: {
        min: metrics.responseTime.min === Infinity ? 0 : metrics.responseTime.min,
        max: metrics.responseTime.max,
        avg: metrics.responseTime.avg
      }
    },
    embeddings: {
      generated: metrics.embeddings.generated,
      avgGenerationTime: metrics.embeddings.avgTime
    },
    searches: {
      total: metrics.searches.total,
      avgResults: metrics.searches.avgResultCount,
      avgResponseTime: metrics.searches.avgResponseTime
    },
    errors: {
      total: metrics.errors.total,
      by4xx: metrics.errors.by4xx,
      by5xx: metrics.errors.by5xx,
      errorRate: metrics.requests.total > 0
        ? ((metrics.errors.total / metrics.requests.total) * 100).toFixed(2) + '%'
        : 'N/A',
      topErrors: Object.entries(metrics.errors.byType)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .reduce((obj, [key, val]) => ({ ...obj, [key]: val }), {})
    },
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  };
}

/**
 * Prometheus-Format (optional)
 */
export function getPrometheusMetrics() {
  const m = getMetrics();
  
  return `
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total ${m.requests.total}

# HELP http_requests_success Total number of successful HTTP requests
# TYPE http_requests_success counter
http_requests_success ${m.requests.success}

# HELP http_requests_errors Total number of failed HTTP requests
# TYPE http_requests_errors counter
http_requests_errors ${m.requests.errors}

# HELP http_response_time_ms HTTP response time in milliseconds
# TYPE http_response_time_ms gauge
http_response_time_ms{type="min"} ${m.performance.responseTime.min}
http_response_time_ms{type="max"} ${m.performance.responseTime.max}
http_response_time_ms{type="avg"} ${m.performance.responseTime.avg}

# HELP embeddings_generated_total Total number of embeddings generated
# TYPE embeddings_generated_total counter
embeddings_generated_total ${m.embeddings.generated}

# HELP embeddings_generation_time_ms Average embedding generation time in milliseconds
# TYPE embeddings_generation_time_ms gauge
embeddings_generation_time_ms ${m.embeddings.avgGenerationTime}

# HELP searches_total Total number of searches performed
# TYPE searches_total counter
searches_total ${m.searches.total}

# HELP process_uptime_seconds Process uptime in seconds
# TYPE process_uptime_seconds counter
process_uptime_seconds ${Math.floor(m.uptime.ms / 1000)}

# HELP nodejs_heap_size_used_bytes Node.js heap size used in bytes
# TYPE nodejs_heap_size_used_bytes gauge
nodejs_heap_size_used_bytes ${m.memory.heapUsed}

# HELP nodejs_heap_size_total_bytes Node.js heap size total in bytes
# TYPE nodejs_heap_size_total_bytes gauge
nodejs_heap_size_total_bytes ${m.memory.heapTotal}
`.trim();
}

/**
 * Metriken zurücksetzen
 */
export function resetMetrics() {
  metrics.requests.total = 0;
  metrics.requests.success = 0;
  metrics.requests.errors = 0;
  metrics.requests.byMethod = {};
  metrics.requests.byEndpoint = {};
  metrics.responseTime.min = Infinity;
  metrics.responseTime.max = 0;
  metrics.responseTime.avg = 0;
  metrics.responseTime.samples = [];
  metrics.embeddings.generated = 0;
  metrics.embeddings.totalTime = 0;
  metrics.embeddings.avgTime = 0;
  metrics.searches.total = 0;
  metrics.searches.avgResultCount = 0;
  metrics.searches.avgResponseTime = 0;
  metrics.errors.total = 0;
  metrics.errors.by4xx = 0;
  metrics.errors.by5xx = 0;
  metrics.errors.byType = {};
  metrics.startTime = Date.now();
}

export default {
  recordRequest,
  recordEmbedding,
  recordSearch,
  recordError,
  getMetrics,
  getPrometheusMetrics,
  resetMetrics
};
