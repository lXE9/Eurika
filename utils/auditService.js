/**
 * Audit-Trail Service
 * Speichert alle User-Aktionen in Supabase audit_logs
 */

import { supabase } from '../supabaseClient.js';
import logger, { logAudit } from './logger.js';

/**
 * Log einer User-Aktion
 * @param {Object} auditData - Audit-Daten
 * @param {string} auditData.userId - User-ID oder 'anonymous'
 * @param {string} auditData.action - Aktion (create, update, delete, search, etc.)
 * @param {string} auditData.resource - Ressource (problem, solution, embedding)
 * @param {string} [auditData.resourceId] - ID des Objekts
 * @param {Object} [auditData.req] - Express Request-Objekt
 * @param {Object} [auditData.metadata] - Zusätzliche Daten
 * @param {number} [auditData.responseStatus] - HTTP-Status
 * @param {string} [auditData.errorMessage] - Fehlermeldung
 */
export async function logAuditTrail(auditData) {
  try {
    const {
      userId = 'anonymous',
      action,
      resource,
      resourceId = null,
      req = null,
      metadata = {},
      responseStatus = 200,
      errorMessage = null
    } = auditData;

    // Validierung
    if (!action || !resource) {
      logger.warn('Audit-Log fehlgeschlagen: action und resource sind erforderlich');
      return;
    }

    // Audit-Eintrag erstellen
    const auditEntry = {
      user_id: userId,
      ip_address: req?.ip || req?.connection?.remoteAddress || null,
      user_agent: req?.get('user-agent') || null,
      action,
      resource,
      resource_id: resourceId,
      method: req?.method || null,
      endpoint: req?.originalUrl || null,
      request_body: ['POST', 'PUT', 'PATCH'].includes(req?.method) 
        ? sanitizeRequestBody(req?.body) 
        : null,
      response_status: responseStatus,
      metadata: metadata || {},
      error_message: errorMessage
    };

    // In Supabase speichern
    const { error } = await supabase
      .from('audit_logs')
      .insert(auditEntry);

    if (error) {
      logger.error('Fehler beim Speichern des Audit-Logs', { meta: { error: error.message } });
    } else {
      // Auch im lokalen Logger loggen
      logAudit(action, userId, resource, resourceId, metadata);
    }

  } catch (error) {
    logger.error('Kritischer Fehler bei Audit-Logging', { meta: { error: error.message } });
  }
}

/**
 * Request-Body sanitieren (sensible Daten entfernen)
 * @private
 */
function sanitizeRequestBody(body) {
  if (!body) return null;

  const sanitized = { ...body };
  
  // Sensible Felder entfernen
  const sensitiveFields = ['password', 'apiKey', 'secret', 'token', 'authorization'];
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });

  return sanitized;
}

/**
 * Middleware: Audit-Logging für alle Requests
 * @param {Object} options - Optionen
 * @param {Function} [options.getUserId] - Funktion um User-ID zu extrahieren
 */
export function auditMiddleware(options = {}) {
  const { getUserId = (req) => req.user?.id || 'anonymous' } = options;

  return async (req, res, next) => {
    // Original res.json überschreiben um Response zu loggen
    const originalJson = res.json.bind(res);
    
    res.json = function(data) {
      // Audit-Log nach Response
      setImmediate(() => {
        // Nur erfolgreiche Mutationen loggen
        const shouldLog = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
        
        if (shouldLog) {
          const action = {
            POST: 'create',
            PUT: 'update',
            PATCH: 'update',
            DELETE: 'delete'
          }[req.method];

          const resource = extractResourceFromPath(req.path);
          const resourceId = req.params.id || data?.data?.id || null;

          logAuditTrail({
            userId: getUserId(req),
            action,
            resource,
            resourceId,
            req,
            responseStatus: res.statusCode,
            metadata: {
              success: res.statusCode < 400,
              responseSize: JSON.stringify(data).length
            }
          });
        }
      });

      return originalJson(data);
    };

    next();
  };
}

/**
 * Ressourcen-Typ aus URL-Pfad extrahieren
 * @private
 */
function extractResourceFromPath(path) {
  // /api/problems/:id -> problem
  // /api/solutions/:id -> solution
  // /api/search -> search
  
  const match = path.match(/\/api\/(problems?|solutions?|search|embeddings?)/);
  if (match) {
    return match[1].replace(/s$/, ''); // Plural -> Singular
  }
  
  return 'unknown';
}

/**
 * Audit-Logs für einen User abrufen
 * @param {string} userId - User-ID
 * @param {number} [limit=50] - Max. Anzahl
 */
export async function getUserAuditLogs(userId, limit = 50) {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;

  } catch (error) {
    logger.error('Fehler beim Abrufen der Audit-Logs', { meta: { error: error.message } });
    throw error;
  }
}

/**
 * Audit-Logs für eine Ressource abrufen
 * @param {string} resourceType - Ressourcen-Typ (problem, solution)
 * @param {string} resourceId - Ressourcen-ID
 * @param {number} [limit=20] - Max. Anzahl
 */
export async function getResourceAuditLogs(resourceType, resourceId, limit = 20) {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('resource', resourceType)
      .eq('resource_id', resourceId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;

  } catch (error) {
    logger.error('Fehler beim Abrufen der Ressourcen-Audit-Logs', { meta: { error: error.message } });
    throw error;
  }
}

export default {
  logAuditTrail,
  auditMiddleware,
  getUserAuditLogs,
  getResourceAuditLogs
};
