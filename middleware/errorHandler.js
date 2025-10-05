/**
 * Zentrale Error-Handling Middleware für Express
 * Fängt alle Fehler ab, inkl. SQLite, Supabase und Validierungsfehler
 */

import logger, { logError } from '../utils/logger.js';

/**
 * Custom Error-Klasse für API-Fehler
 */
export class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.name = 'ApiError';
  }
}

/**
 * Error-Handler Middleware
 * Muss als letzte Middleware registriert werden
 */
export function errorHandler(err, req, res, next) {
  // Strukturiertes Logging mit Winston
  logError(err, req);

  // ========== Supabase/PostgreSQL Fehler ==========
  
  // Constraint-Violation (z.B. Unique, Foreign Key)
  if (err.code === '23505' || err.message?.includes('duplicate key')) {
    return res.status(409).json({
      success: false,
      error: 'Ressource existiert bereits',
      message: 'Ein Eintrag mit diesen Daten existiert bereits',
      code: 'DUPLICATE_KEY'
    });
  }

  if (err.code === '23503' || err.message?.includes('foreign key')) {
    return res.status(400).json({
      success: false,
      error: 'Referenz-Fehler',
      message: 'Das referenzierte Objekt existiert nicht',
      code: 'FOREIGN_KEY_VIOLATION'
    });
  }

  if (err.code === '23502' || err.message?.includes('null value')) {
    return res.status(400).json({
      success: false,
      error: 'Pflichtfeld fehlt',
      message: 'Ein erforderliches Feld wurde nicht angegeben',
      code: 'NOT_NULL_VIOLATION'
    });
  }

  // Connection-Errors
  if (err.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED')) {
    return res.status(503).json({
      success: false,
      error: 'Datenbankverbindung fehlgeschlagen',
      message: 'Die Datenbank ist nicht erreichbar',
      code: 'CONNECTION_REFUSED'
    });
  }

  if (err.code === 'ETIMEDOUT' || err.message?.includes('timeout')) {
    return res.status(504).json({
      success: false,
      error: 'Zeitüberschreitung',
      message: 'Die Anfrage hat zu lange gedauert',
      code: 'TIMEOUT'
    });
  }

  // ========== SQLite Fehler (Legacy) ==========
  
  if (err.code === 'SQLITE_CONSTRAINT') {
    return res.status(400).json({
      success: false,
      error: 'Datenbankbeschränkung verletzt',
      message: err.message,
      code: 'CONSTRAINT_VIOLATION'
    });
  }

  if (err.code === 'SQLITE_BUSY') {
    return res.status(503).json({
      success: false,
      error: 'Datenbank ist beschäftigt',
      message: 'Bitte versuchen Sie es später erneut',
      code: 'DATABASE_BUSY'
    });
  }

  // ========== Anwendungs-Fehler ==========
  
  if (err.message && err.message.includes('nicht gefunden')) {
    return res.status(404).json({
      success: false,
      error: 'Ressource nicht gefunden',
      message: err.message,
      code: 'NOT_FOUND'
    });
  }

  if (err.message && err.message.includes('Validierungsfehler')) {
    return res.status(400).json({
      success: false,
      error: 'Validierungsfehler',
      message: err.message,
      code: 'VALIDATION_ERROR'
    });
  }

  // Custom ApiError
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      details: err.details,
      code: 'API_ERROR'
    });
  }

  // ========== Generischer Fehler ==========
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Interner Serverfehler';

  res.status(statusCode).json({
    success: false,
    error: message,
    code: 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

/**
 * 404 Handler für nicht existierende Routen
 */
export function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    error: 'Route nicht gefunden',
    message: `Die Route ${req.method} ${req.path} existiert nicht`,
    code: 'ROUTE_NOT_FOUND'
  });
}

/**
 * Async Handler Wrapper
 * Fängt Fehler in async Route-Handlern automatisch ab
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
