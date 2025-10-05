/**
 * Validation Middleware für Request-Validierung
 * Enterprise-Qualität mit detaillierten Fehlermeldungen
 */

import { ApiError } from './errorHandler.js';

/**
 * Validiert Problem-Daten
 */
export function validateProblem(req, res, next) {
  const { title, description, tags } = req.body;
  const errors = [];

  // Title-Validierung
  if (!title) {
    errors.push('Titel ist erforderlich');
  } else if (typeof title !== 'string') {
    errors.push('Titel muss ein String sein');
  } else if (title.trim().length === 0) {
    errors.push('Titel darf nicht leer sein');
  } else if (title.length > 255) {
    errors.push('Titel darf maximal 255 Zeichen lang sein');
  }

  // Description-Validierung
  if (!description) {
    errors.push('Beschreibung ist erforderlich');
  } else if (typeof description !== 'string') {
    errors.push('Beschreibung muss ein String sein');
  } else if (description.trim().length === 0) {
    errors.push('Beschreibung darf nicht leer sein');
  }

  // Tags-Validierung (optional)
  if (tags !== undefined && tags !== null) {
    if (!Array.isArray(tags) && typeof tags !== 'string') {
      errors.push('Tags müssen ein Array oder String sein');
    }
  }

  if (errors.length > 0) {
    throw new ApiError(400, 'Validierungsfehler', errors);
  }

  next();
}

/**
 * Validiert Problem-Update-Daten
 */
export function validateProblemUpdate(req, res, next) {
  const { title, description, tags } = req.body;
  const errors = [];

  // Mindestens ein Feld muss vorhanden sein
  if (title === undefined && description === undefined && tags === undefined) {
    throw new ApiError(400, 'Mindestens ein Feld (title, description, tags) muss angegeben werden');
  }

  // Title-Validierung (falls vorhanden)
  if (title !== undefined) {
    if (typeof title !== 'string') {
      errors.push('Titel muss ein String sein');
    } else if (title.trim().length === 0) {
      errors.push('Titel darf nicht leer sein');
    } else if (title.length > 255) {
      errors.push('Titel darf maximal 255 Zeichen lang sein');
    }
  }

  // Description-Validierung (falls vorhanden)
  if (description !== undefined) {
    if (typeof description !== 'string') {
      errors.push('Beschreibung muss ein String sein');
    } else if (description.trim().length === 0) {
      errors.push('Beschreibung darf nicht leer sein');
    }
  }

  // Tags-Validierung (falls vorhanden)
  if (tags !== undefined && tags !== null) {
    if (!Array.isArray(tags) && typeof tags !== 'string') {
      errors.push('Tags müssen ein Array oder String sein');
    }
  }

  if (errors.length > 0) {
    throw new ApiError(400, 'Validierungsfehler', errors);
  }

  next();
}

/**
 * Validiert UUID (Supabase)
 */
function isValidUUID(str) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Validiert UUID-Parameter
 */
export function validateUuidParam(req, res, next) {
  const id = req.params.id;

  if (!id || !isValidUUID(id)) {
    throw new ApiError(400, 'Ungültige ID: Muss eine gültige UUID sein');
  }

  next();
}

/**
 * Validiert Lösungs-Daten (Supabase)
 */
export function validateSolution(req, res, next) {
  const { problemId, description, source } = req.body;
  const errors = [];

  // ProblemId-Validierung (UUID für Supabase)
  if (!problemId) {
    errors.push('Problem-ID ist erforderlich');
  } else if (typeof problemId !== 'string' || !isValidUUID(problemId)) {
    errors.push('Problem-ID muss eine gültige UUID sein');
  }

  // Description-Validierung
  if (!description) {
    errors.push('Beschreibung ist erforderlich');
  } else if (typeof description !== 'string') {
    errors.push('Beschreibung muss ein String sein');
  } else if (description.trim().length === 0) {
    errors.push('Beschreibung darf nicht leer sein');
  }

  // Source-Validierung (optional)
  if (source !== undefined && source !== null) {
    if (typeof source !== 'string') {
      errors.push('Quelle muss ein String sein');
    }
  }

  if (errors.length > 0) {
    throw new ApiError(400, 'Validierungsfehler', errors);
  }

  next();
}

/**
 * Validiert Lösungs-Update-Daten
 */
export function validateSolutionUpdate(req, res, next) {
  const { description, source } = req.body;
  const errors = [];

  // Mindestens ein Feld muss vorhanden sein
  if (description === undefined && source === undefined) {
    throw new ApiError(400, 'Mindestens ein Feld (description, source) muss angegeben werden');
  }

  // Description-Validierung (falls vorhanden)
  if (description !== undefined) {
    if (typeof description !== 'string') {
      errors.push('Beschreibung muss ein String sein');
    } else if (description.trim().length === 0) {
      errors.push('Beschreibung darf nicht leer sein');
    }
  }

  // Source-Validierung (falls vorhanden)
  if (source !== undefined && source !== null) {
    if (typeof source !== 'string') {
      errors.push('Quelle muss ein String sein');
    }
  }

  if (errors.length > 0) {
    throw new ApiError(400, 'Validierungsfehler', errors);
  }

  next();
}

/**
 * Validiert ID-Parameter
 */
export function validateIdParam(req, res, next) {
  const id = parseInt(req.params.id);

  if (isNaN(id) || id <= 0) {
    throw new ApiError(400, 'Ungültige ID: Muss eine positive Ganzzahl sein');
  }

  req.params.id = id; // Als Zahl speichern
  next();
}

/**
 * Validiert Query-Parameter für Pagination und Suche
 */
export function validateQueryParams(req, res, next) {
  const { limit, offset, searchTerm } = req.query;
  const errors = [];

  // Limit validieren
  if (limit !== undefined) {
    const limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum <= 0 || limitNum > 1000) {
      errors.push('Limit muss zwischen 1 und 1000 liegen');
    } else {
      req.query.limit = limitNum;
    }
  }

  // Offset validieren
  if (offset !== undefined) {
    const offsetNum = parseInt(offset);
    if (isNaN(offsetNum) || offsetNum < 0) {
      errors.push('Offset muss eine nicht-negative Zahl sein');
    } else {
      req.query.offset = offsetNum;
    }
  }

  // SearchTerm validieren
  if (searchTerm !== undefined && typeof searchTerm !== 'string') {
    errors.push('SearchTerm muss ein String sein');
  }

  if (errors.length > 0) {
    throw new ApiError(400, 'Validierungsfehler in Query-Parametern', errors);
  }

  next();
}

/**
 * Validiert Suche-Parameter
 */
export function validateSearchParams(req, res, next) {
  const { query, limit, threshold } = req.body;
  const errors = [];

  // Query validieren
  if (!query) {
    errors.push('Query ist erforderlich');
  } else if (typeof query !== 'string') {
    errors.push('Query muss ein String sein');
  } else if (query.trim().length === 0) {
    errors.push('Query darf nicht leer sein');
  } else if (query.length > 500) {
    errors.push('Query darf maximal 500 Zeichen lang sein');
  }

  // Limit validieren (optional)
  if (limit !== undefined) {
    const limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum <= 0 || limitNum > 100) {
      errors.push('Limit muss zwischen 1 und 100 liegen');
    }
  }

  // Threshold validieren (optional)
  if (threshold !== undefined) {
    const thresholdNum = parseFloat(threshold);
    if (isNaN(thresholdNum) || thresholdNum < 0 || thresholdNum > 1) {
      errors.push('Threshold muss zwischen 0 und 1 liegen');
    }
  }

  if (errors.length > 0) {
    throw new ApiError(400, 'Validierungsfehler in Such-Parametern', errors);
  }

  next();
}
