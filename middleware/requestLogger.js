/**
 * Request-Logging Middleware
 * Loggt alle eingehenden Requests mit Response-Time
 */

import logger, { logRequest } from '../utils/logger.js';
import { recordRequest } from '../utils/metrics.js';

/**
 * Request-Logging Middleware
 */
export function requestLogger(req, res, next) {
  const startTime = Date.now();
  
  // Request-ID generieren (für Tracing)
  req.id = generateRequestId();
  
  // Original res.json überschreiben
  const originalJson = res.json.bind(res);
  
  res.json = function(data) {
    const responseTime = Date.now() - startTime;
    
    // Logging
    logRequest(req, res, responseTime);
    
    // Metriken erfassen
    recordRequest(req.method, req.originalUrl, res.statusCode, responseTime);
    
    return originalJson(data);
  };
  
  // Auch bei res.send() loggen
  const originalSend = res.send.bind(res);
  
  res.send = function(data) {
    const responseTime = Date.now() - startTime;
    
    // Nur loggen wenn noch nicht geloggt (json ruft send auf)
    if (!res.headersSent) {
      logRequest(req, res, responseTime);
      recordRequest(req.method, req.originalUrl, res.statusCode, responseTime);
    }
    
    return originalSend(data);
  };
  
  next();
}

/**
 * Request-ID generieren
 */
function generateRequestId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Detailed Request Logger (nur für Debug)
 */
export function detailedRequestLogger(req, res, next) {
  logger.debug('Incoming Request', {
    meta: {
      id: req.id,
      method: req.method,
      url: req.originalUrl,
      headers: req.headers,
      body: req.body,
      query: req.query,
      params: req.params,
      ip: req.ip
    }
  });
  
  next();
}

export default requestLogger;
