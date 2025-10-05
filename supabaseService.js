/**
 * Supabase Service für IT-Problems Tracker
 * CRUD-Operationen mit Embedding-Integration
 */

import { supabase } from './supabaseClient.js';
import { generateEmbedding, cosineSimilarity } from './embeddingService.js';

/**
 * 🔹 Problem mit Embedding hinzufügen
 * @param {Object} problemData - Problem-Daten
 * @param {string} problemData.title - Titel
 * @param {string} problemData.description - Beschreibung
 * @param {Array<string>} [problemData.tags] - Tags
 * @returns {Object} Erstelltes Problem mit ID
 */
export async function addProblemWithEmbedding({ title, description, tags = [] }) {
  try {
    // Validierung
    if (!title || !description) {
      throw new Error('Titel und Beschreibung sind erforderlich');
    }

    // 1. Problem in Datenbank einfügen
    const { data: problem, error: problemError } = await supabase
      .from('problems')
      .insert({
        title: title.trim(),
        description: description.trim(),
        tags: tags
      })
      .select()
      .single();

    if (problemError) {
      throw new Error(`Fehler beim Einfügen des Problems: ${problemError.message}`);
    }

    console.log(`✓ Problem erstellt mit ID: ${problem.id}`);

    // 2. Embedding generieren (async mit all-MiniLM-L6-v2)
    console.log(`🔄 Generiere Embedding für Problem ${problem.id}...`);
    const textForEmbedding = `${title} ${description}`;
    const embedding = await generateEmbedding(textForEmbedding);
    console.log(`✓ Embedding generiert (${embedding.length} Dimensionen)`);

    // 3. Embedding in Datenbank speichern
    const { data: embeddingData, error: embeddingError } = await supabase
      .from('embeddings')
      .insert({
        problem_id: problem.id,
        vector: embedding,
        model_name: 'all-MiniLM-L6-v2'
      })
      .select()
      .single();

    if (embeddingError) {
      console.error('⚠️ Warnung: Embedding konnte nicht gespeichert werden:', embeddingError.message);
    } else {
      console.log(`✓ Embedding gespeichert für Problem ${problem.id}`);
    }

    return {
      ...problem,
      embedding_created: !embeddingError
    };

  } catch (error) {
    console.error('✗ Fehler bei addProblemWithEmbedding:', error.message);
    throw error;
  }
}

/**
 * 🔍 Semantische Suche mit Cosine-Similarity
 * @param {string} query - Suchanfrage
 * @param {number} [limit=5] - Max. Anzahl der Ergebnisse
 * @param {number} [threshold=0.1] - Min. Similarity-Score
 * @returns {Array} Top relevante Probleme mit Lösungen
 */
export async function semanticSearch(query, limit = 5, threshold = 0.1) {
  try {
    if (!query || typeof query !== 'string') {
      throw new Error('Query muss ein nicht-leerer String sein');
    }

    console.log(`🔍 Semantische Suche: "${query}"`);

    // 1. Query-Embedding generieren (async mit all-MiniLM-L6-v2)
    const queryEmbedding = await generateEmbedding(query);
    console.log(`✓ Query-Embedding generiert (${queryEmbedding.length} Dimensionen)`);

    // 2. Alle Embeddings aus Datenbank abrufen
    const { data: embeddings, error: embeddingsError } = await supabase
      .from('embeddings')
      .select('id, problem_id, vector');

    if (embeddingsError) {
      throw new Error(`Fehler beim Abrufen der Embeddings: ${embeddingsError.message}`);
    }

    if (!embeddings || embeddings.length === 0) {
      console.log('ℹ️ Keine Embeddings gefunden');
      return [];
    }

    // pgvector gibt Strings zurück - in Array konvertieren
    console.log(`✓ ${embeddings.length} Embeddings aus Datenbank abgerufen`);

    // 3. Similarity-Scores berechnen
    const similarities = embeddings.map(emb => {
      try {
        // pgvector gibt String zurück - konvertieren zu Array
        let dbVector = emb.vector;
        
        // Falls String (pgvector-Format), parsen
        if (typeof dbVector === 'string') {
          // Format: "[0.1, 0.2, ...]" -> Array
          dbVector = JSON.parse(dbVector.replace(/^\[/, '[').replace(/\]$/, ']'));
        }
        
        // Validierung: Beide Vektoren müssen 384 Dimensionen haben
        
        // Falls Vektor aus DB nicht die richtige Länge hat, anpassen
        if (!Array.isArray(dbVector)) {
          console.warn(`⚠️ Embedding für Problem ${emb.problem_id} ist kein Array`);
          return null;
        }
        
        if (dbVector.length !== queryEmbedding.length) {
          console.warn(`⚠️ Vektorlänge stimmt nicht überein: DB=${dbVector.length}, Query=${queryEmbedding.length}`);
          // Vektor auf 384 anpassen
          if (dbVector.length < 384) {
            dbVector = dbVector.concat(new Array(384 - dbVector.length).fill(0));
          } else {
            dbVector = dbVector.slice(0, 384);
          }
        }
        
        return {
          problem_id: emb.problem_id,
          similarity: cosineSimilarity(queryEmbedding, dbVector)
        };
      } catch (error) {
        console.error(`✗ Fehler bei Similarity-Berechnung für Problem ${emb.problem_id}:`, error.message);
        return null;
      }
    }).filter(s => s !== null); // Fehlerhafte Embeddings ausfiltern

    // 4. Nach Similarity sortieren und filtern
    const topMatches = similarities
      .filter(item => item.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    if (topMatches.length === 0) {
      console.log('ℹ️ Keine Ergebnisse über Threshold gefunden');
      return [];
    }

    // 5. Problem-Details und Lösungen abrufen
    const problemIds = topMatches.map(m => m.problem_id);
    
    const { data: problems, error: problemsError } = await supabase
      .from('problems')
      .select(`
        id,
        title,
        description,
        tags,
        created_at,
        solutions (
          id,
          description,
          source,
          created_at
        )
      `)
      .in('id', problemIds);

    if (problemsError) {
      throw new Error(`Fehler beim Abrufen der Probleme: ${problemsError.message}`);
    }

    // 6. Similarity-Scores zu Problemen hinzufügen
    const results = problems.map(problem => {
      const match = topMatches.find(m => m.problem_id === problem.id);
      return {
        ...problem,
        similarity: match.similarity,
        relevance_score: Math.round(match.similarity * 100)
      };
    });

    // Nach Similarity sortieren
    results.sort((a, b) => b.similarity - a.similarity);

    console.log(`✓ ${results.length} relevante Probleme gefunden`);
    return results;

  } catch (error) {
    console.error('✗ Fehler bei semanticSearch:', error.message);
    throw error;
  }
}

/**
 * 📋 Lösungen zu einem Problem abrufen
 * @param {string} problemId - Problem-ID (UUID)
 * @returns {Array} Lösungen
 */
export async function getSolutionsByProblemId(problemId) {
  try {
    if (!problemId) {
      throw new Error('Problem-ID ist erforderlich');
    }

    const { data: solutions, error } = await supabase
      .from('solutions')
      .select('*')
      .eq('problem_id', problemId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Fehler beim Abrufen der Lösungen: ${error.message}`);
    }

    console.log(`✓ ${solutions.length} Lösungen für Problem ${problemId} gefunden`);
    return solutions;

  } catch (error) {
    console.error('✗ Fehler bei getSolutionsByProblemId:', error.message);
    throw error;
  }
}

/**
 * ➕ Lösung zu Problem hinzufügen
 * @param {Object} solutionData - Lösungs-Daten
 * @param {string} solutionData.problemId - Problem-ID
 * @param {string} solutionData.description - Beschreibung
 * @param {string} [solutionData.source] - Quelle
 * @returns {Object} Erstellte Lösung
 */
export async function addSolution({ problemId, description, source = null }) {
  try {
    if (!problemId || !description) {
      throw new Error('Problem-ID und Beschreibung sind erforderlich');
    }

    const { data: solution, error } = await supabase
      .from('solutions')
      .insert({
        problem_id: problemId,
        description: description.trim(),
        source: source
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Fehler beim Einfügen der Lösung: ${error.message}`);
    }

    console.log(`✓ Lösung erstellt mit ID: ${solution.id}`);
    return solution;

  } catch (error) {
    console.error('✗ Fehler bei addSolution:', error.message);
    throw error;
  }
}

/**
 * 📖 Problem mit allen Lösungen abrufen
 * @param {string} problemId - Problem-ID (UUID)
 * @returns {Object} Problem mit solutions-Array
 */
export async function getProblemWithSolutions(problemId) {
  try {
    if (!problemId) {
      throw new Error('Problem-ID ist erforderlich');
    }

    const { data: problem, error } = await supabase
      .from('problems')
      .select(`
        *,
        solutions (*)
      `)
      .eq('id', problemId)
      .single();

    if (error) {
      throw new Error(`Fehler beim Abrufen des Problems: ${error.message}`);
    }

    return problem;

  } catch (error) {
    console.error('✗ Fehler bei getProblemWithSolutions:', error.message);
    throw error;
  }
}

/**
 * 📝 Alle Probleme abrufen
 * @param {Object} [options] - Optionen
 * @param {number} [options.limit=50] - Max. Anzahl
 * @param {number} [options.offset=0] - Offset
 * @returns {Array} Probleme
 */
export async function getAllProblems({ limit = 50, offset = 0 } = {}) {
  try {
    const { data: problems, error } = await supabase
      .from('problems')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Fehler beim Abrufen der Probleme: ${error.message}`);
    }

    return problems;

  } catch (error) {
    console.error('✗ Fehler bei getAllProblems:', error.message);
    throw error;
  }
}

/**
 * 🗑️ Problem löschen (inkl. Embeddings und Lösungen via CASCADE)
 * @param {string} problemId - Problem-ID (UUID)
 * @returns {boolean} Erfolg
 */
export async function deleteProblem(problemId) {
  try {
    if (!problemId) {
      throw new Error('Problem-ID ist erforderlich');
    }

    const { error } = await supabase
      .from('problems')
      .delete()
      .eq('id', problemId);

    if (error) {
      throw new Error(`Fehler beim Löschen des Problems: ${error.message}`);
    }

    console.log(`✓ Problem ${problemId} gelöscht (inkl. Embeddings und Lösungen)`);
    return true;

  } catch (error) {
    console.error('✗ Fehler bei deleteProblem:', error.message);
    throw error;
  }
}

/**
 * 🔄 Embedding für bestehendes Problem aktualisieren
 * @param {string} problemId - Problem-ID (UUID)
 * @returns {Object} Aktualisiertes Embedding
 */
export async function updateEmbedding(problemId) {
  try {
    // Problem abrufen
    const { data: problem, error: problemError } = await supabase
      .from('problems')
      .select('title, description')
      .eq('id', problemId)
      .single();

    if (problemError) {
      throw new Error(`Problem nicht gefunden: ${problemError.message}`);
    }

    // Neues Embedding generieren (async mit all-MiniLM-L6-v2)
    const textForEmbedding = `${problem.title} ${problem.description}`;
    const embedding = await generateEmbedding(textForEmbedding);

    // Embedding aktualisieren oder einfügen
    const { data, error } = await supabase
      .from('embeddings')
      .upsert({
        problem_id: problemId,
        vector: embedding,
        model_name: 'all-MiniLM-L6-v2'
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Fehler beim Aktualisieren des Embeddings: ${error.message}`);
    }

    console.log(`✓ Embedding für Problem ${problemId} aktualisiert`);
    return data;

  } catch (error) {
    console.error('✗ Fehler bei updateEmbedding:', error.message);
    throw error;
  }
}

/**
 * 📝 Problem aktualisieren
 * @param {string} problemId - Problem-ID (UUID)
 * @param {Object} updateData - Zu aktualisierende Daten
 * @param {string} [updateData.title] - Neuer Titel
 * @param {string} [updateData.description] - Neue Beschreibung
 * @param {Array<string>} [updateData.tags] - Neue Tags
 * @param {boolean} [regenerateEmbedding=true] - Embedding neu generieren?
 * @returns {Object} Aktualisiertes Problem
 */
export async function updateProblem(problemId, updateData, regenerateEmbedding = true) {
  try {
    if (!problemId) {
      throw new Error('Problem-ID ist erforderlich');
    }

    // Daten bereinigen
    const cleanData = {};
    if (updateData.title) cleanData.title = updateData.title.trim();
    if (updateData.description) cleanData.description = updateData.description.trim();
    if (updateData.tags !== undefined) cleanData.tags = updateData.tags;

    if (Object.keys(cleanData).length === 0) {
      throw new Error('Keine Daten zum Aktualisieren angegeben');
    }

    // Problem aktualisieren
    const { data: problem, error } = await supabase
      .from('problems')
      .update(cleanData)
      .eq('id', problemId)
      .select()
      .single();

    if (error) {
      throw new Error(`Fehler beim Aktualisieren des Problems: ${error.message}`);
    }

    console.log(`✓ Problem ${problemId} aktualisiert`);

    // Embedding neu generieren wenn Title oder Description geändert wurde
    if (regenerateEmbedding && (updateData.title || updateData.description)) {
      console.log('🔄 Generiere neues Embedding...');
      try {
        await updateEmbedding(problemId);
        problem.embedding_updated = true;
      } catch (embError) {
        console.warn('⚠️ Warnung: Embedding konnte nicht aktualisiert werden:', embError.message);
        problem.embedding_updated = false;
      }
    }

    return problem;

  } catch (error) {
    console.error('✗ Fehler bei updateProblem:', error.message);
    throw error;
  }
}

export default {
  addProblemWithEmbedding,
  semanticSearch,
  getSolutionsByProblemId,
  addSolution,
  getProblemWithSolutions,
  getAllProblems,
  deleteProblem,
  updateEmbedding,
  updateProblem
};
