/**
 * Strukturiertes Logging mit Winston
 * Enterprise-Qualität mit Log-Rotation und Levels
 */

import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log-Levels: error, warn, info, http, verbose, debug, silly
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Farben für Console-Output
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

winston.addColors(colors);

// Log-Level basierend auf Environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'info';
};

// Format für Console (mit Farben und Emojis)
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const emoji = {
      error: '❌',
      warn: '⚠️',
      info: '✓',
      http: '🌐',
      debug: '🔍'
    }[info.level.replace(/\u001b\[\d+m/g, '')] || 'ℹ️';

    let message = `${info.timestamp} ${emoji} ${info.level}: ${info.message}`;
    
    // Zusätzliche Felder anzeigen
    if (info.meta && Object.keys(info.meta).length > 0) {
      message += `\n  ${JSON.stringify(info.meta, null, 2)}`;
    }
    
    // Stack-Trace bei Errors
    if (info.stack) {
      message += `\n${info.stack}`;
    }
    
    return message;
  })
);

// Format für Dateien (JSON für Parsing)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Transports
const transports = [
  // Console (nur in Development mit Debug-Level)
  new winston.transports.Console({
    format: consoleFormat,
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
  }),
  
  // Error-Log (nur Errors)
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'error.log'),
    level: 'error',
    format: fileFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
  
  // Combined-Log (alles)
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'combined.log'),
    format: fileFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
];

// Logger erstellen
const logger = winston.createLogger({
  level: level(),
  levels,
  transports,
  exitOnError: false,
});

// Hilfsfunktionen für strukturiertes Logging
export const logRequest = (req, res, responseTime) => {
  logger.http('HTTP Request', {
    meta: {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      userAgent: req.get('user-agent'),
      ip: req.ip,
      userId: req.user?.id || 'anonymous'
    }
  });
};

export const logError = (error, req = null) => {
  logger.error(error.message, {
    meta: {
      stack: error.stack,
      code: error.code,
      statusCode: error.statusCode,
      ...(req && {
        method: req.method,
        url: req.originalUrl,
        userId: req.user?.id
      })
    }
  });
};

export const logAudit = (action, userId, objectType, objectId, details = {}) => {
  logger.info(`Audit: ${action}`, {
    meta: {
      userId,
      action,
      objectType,
      objectId,
      timestamp: new Date().toISOString(),
      ...details
    }
  });
};

export default logger;
