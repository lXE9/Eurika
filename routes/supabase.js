/**
 * REST-API Routes für Supabase-Integration
 * Semantische Suche und externe Quellen
 */

import express from 'express';
import * as supabaseService from '../supabaseService.js';
import * as externalSources from '../externalSourcesService.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { 
  validateProblem, 
  validateProblemUpdate, 
  validateSolution,
  validateUuidParam,
  validateSearchParams
} from '../middleware/validation.js';

const router = express.Router();

/**
 * POST /api/problems
 * Problem mit Embedding erstellen
 */
router.post('/problems', validateProblem, asyncHandler(async (req, res) => {
  const { title, description, tags } = req.body;

  if (!title || !description) {
    return res.status(400).json({
      success: false,
      error: 'Titel und Beschreibung sind erforderlich'
    });
  }

  const problem = await supabaseService.addProblemWithEmbedding({
    title,
    description,
    tags: tags || []
  });

  res.status(201).json({
    success: true,
    message: 'Problem mit Embedding erstellt',
    data: problem
  });
}));

/**
 * GET /api/supabase/problems
 * Alle Probleme aus Supabase abrufen
 */
router.get('/problems', asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;

  const problems = await supabaseService.getAllProblems({ limit, offset });

  res.json({
    success: true,
    data: problems,
    count: problems.length
  });
}));

/**
 * GET /api/problems/:id
 * Problem mit Lösungen abrufen
 */
router.get('/problems/:id', validateUuidParam, asyncHandler(async (req, res) => {
  const problem = await supabaseService.getProblemWithSolutions(req.params.id);

  res.json({
    success: true,
    data: problem
  });
}));

/**
 * POST /api/solutions
 * Lösung zu Problem hinzufügen
 */
router.post('/solutions', validateSolution, asyncHandler(async (req, res) => {
  const { problemId, description, source } = req.body;

  if (!problemId || !description) {
    return res.status(400).json({
      success: false,
      error: 'Problem-ID und Beschreibung sind erforderlich'
    });
  }

  const solution = await supabaseService.addSolution({
    problemId,
    description,
    source
  });

  res.status(201).json({
    success: true,
    message: 'Lösung erstellt',
    data: solution
  });
}));

/**
 * GET /api/problems/:id/solutions
 * Lösungen eines Problems abrufen
 */
router.get('/problems/:id/solutions', validateUuidParam, asyncHandler(async (req, res) => {
  const solutions = await supabaseService.getSolutionsByProblemId(req.params.id);

  res.json({
    success: true,
    data: solutions,
    count: solutions.length
  });
}));

/**
 * POST /api/search
 * Semantische Suche
 */
router.post('/search', validateSearchParams, asyncHandler(async (req, res) => {
  const { query, limit, threshold } = req.body;

  if (!query) {
    return res.status(400).json({
      success: false,
      error: 'Query ist erforderlich'
    });
  }

  const results = await supabaseService.semanticSearch(
    query,
    limit || 5,
    threshold || 0.1
  );

  res.json({
    success: true,
    query,
    data: results,
    count: results.length
  });
}));

/**
 * POST /api/supabase/search/combined
 * Kombinierte Suche (Supabase + Stack Overflow + YouTube)
 */
router.post('/search/combined', asyncHandler(async (req, res) => {
  const { query, internalLimit, stackOverflowLimit, youtubeLimit } = req.body;

  if (!query) {
    return res.status(400).json({
      success: false,
      error: 'Query ist erforderlich'
    });
  }

  const results = await externalSources.searchAllSources(
    query,
    supabaseService.semanticSearch,
    {
      internalLimit: internalLimit || 5,
      stackOverflowLimit: stackOverflowLimit || 3,
      youtubeLimit: youtubeLimit || 2
    }
  );

  res.json({
    success: true,
    ...results
  });
}));

/**
 * PUT /api/problems/:id
 * Problem aktualisieren
 */
router.put('/problems/:id', validateUuidParam, validateProblemUpdate, asyncHandler(async (req, res) => {
  const { title, description, tags, regenerateEmbedding } = req.body;

  // Mindestens ein Feld muss angegeben sein
  if (!title && !description && tags === undefined) {
    return res.status(400).json({
      success: false,
      error: 'Mindestens ein Feld (title, description, tags) muss angegeben werden'
    });
  }

  const problem = await supabaseService.updateProblem(
    req.params.id,
    { title, description, tags },
    regenerateEmbedding !== false // Default: true
  );

  res.json({
    success: true,
    message: 'Problem aktualisiert',
    data: problem
  });
}));

/**
 * DELETE /api/problems/:id
 * Problem löschen
 */
router.delete('/problems/:id', validateUuidParam, asyncHandler(async (req, res) => {
  await supabaseService.deleteProblem(req.params.id);

  res.json({
    success: true,
    message: 'Problem gelöscht'
  });
}));

/**
 * PUT /api/supabase/problems/:id/embedding
 * Embedding aktualisieren
 */
router.put('/problems/:id/embedding', asyncHandler(async (req, res) => {
  const embedding = await supabaseService.updateEmbedding(req.params.id);

  res.json({
    success: true,
    message: 'Embedding aktualisiert',
    data: embedding
  });
}));

export default router;
