/**
 * Embedding Service für semantische Suche
 * Verwendet all-MiniLM-L6-v2 (Sentence Transformers)
 * State-of-the-Art semantisches Verständnis mit Transformers.js
 */

import { pipeline } from '@xenova/transformers';

// Cache für das Transformer-Modell
let embedder = null;
let isInitializing = false;

/**
 * Modell initialisieren (lazy loading)
 * @returns {Promise<Object>} Feature-Extraction Pipeline
 */
async function initializeModel() {
  if (embedder) {
    return embedder;
  }

  if (isInitializing) {
    // Warte bis Initialisierung abgeschlossen ist
    while (isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return embedder;
  }

  try {
    isInitializing = true;
    console.log('🔄 Lade all-MiniLM-L6-v2 Modell...');
    
    // Feature-Extraction Pipeline mit all-MiniLM-L6-v2
    embedder = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
      { quantized: true } // Kleinere Modellgröße, schneller
    );
    
    console.log('✅ all-MiniLM-L6-v2 Modell erfolgreich geladen');
    isInitializing = false;
    return embedder;
  } catch (error) {
    isInitializing = false;
    console.error('❌ Fehler beim Laden des Modells:', error.message);
    throw error;
  }
}

/**
 * Embedding für einen Text generieren mit all-MiniLM-L6-v2
 * @param {string} text - Text (Problem-Titel + Beschreibung)
 * @param {number} dimensions - Anzahl der Dimensionen (Default: 384)
 * @returns {Promise<Array<number>>} Embedding-Vektor (384 Dimensionen)
 */
export async function generateEmbedding(text, dimensions = 384) {
  try {
    if (!text || typeof text !== 'string') {
      throw new Error('Text muss ein nicht-leerer String sein');
    }

    // Text bereinigen (aber keine aggressive Vorverarbeitung)
    const cleanedText = text.trim();
    
    if (cleanedText.length === 0) {
      throw new Error('Text ist leer nach Bereinigung');
    }

    // Modell laden (falls noch nicht geladen)
    const model = await initializeModel();
    
    // Embedding generieren
    const output = await model(cleanedText, {
      pooling: 'mean',      // Mean Pooling (Standard für sentence embeddings)
      normalize: true        // L2-Normalisierung für Cosine-Similarity
    });
    
    // Tensor zu Array konvertieren
    let embedding = Array.from(output.data);
    
    // Validierung: Sollte bereits 384 Dimensionen haben
    if (embedding.length !== dimensions) {
      console.warn(`⚠️ Unerwartete Embedding-Größe: ${embedding.length}, erwartet: ${dimensions}`);
      
      // Anpassen falls nötig
      if (embedding.length < dimensions) {
        embedding = embedding.concat(new Array(dimensions - embedding.length).fill(0));
      } else {
        embedding = embedding.slice(0, dimensions);
      }
    }
    
    return embedding;

  } catch (error) {
    console.error('✗ Fehler bei Embedding-Generierung:', error.message);
    throw error;
  }
}

/**
 * Cosine-Similarity zwischen zwei Vektoren berechnen
 * @param {Array<number>} vec1 - Erster Vektor
 * @param {Array<number>} vec2 - Zweiter Vektor
 * @returns {number} Similarity Score (0-1)
 */
export function cosineSimilarity(vec1, vec2) {
  if (!vec1 || !vec2 || vec1.length !== vec2.length) {
    throw new Error('Vektoren müssen gleiche Länge haben');
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
  
  if (magnitude === 0) {
    return 0;
  }

  return dotProduct / magnitude;
}

/**
 * Batch-Embedding-Generierung für mehrere Texte
 * @param {Array<string>} texts - Array von Texten
 * @param {number} dimensions - Anzahl der Dimensionen
 * @returns {Promise<Array<Array<number>>>} Array von Embedding-Vektoren
 */
export async function generateEmbeddingsBatch(texts, dimensions = 384) {
  const embeddings = [];
  for (const text of texts) {
    const embedding = await generateEmbedding(text, dimensions);
    embeddings.push(embedding);
  }
  return embeddings;
}

/**
 * Modell vorladen (optional, für schnelleren ersten Request)
 * @returns {Promise<void>}
 */
export async function preloadModel() {
  try {
    console.log('🔄 Preloading all-MiniLM-L6-v2...');
    await initializeModel();
    console.log('✅ Modell vorgeladen');
  } catch (error) {
    console.error('❌ Fehler beim Vorladen:', error.message);
  }
}

/**
 * Modell-Info abrufen
 * @returns {Object} Modell-Informationen
 */
export function getModelInfo() {
  return {
    name: 'all-MiniLM-L6-v2',
    source: 'sentence-transformers/all-MiniLM-L6-v2',
    dimensions: 384,
    maxTokens: 256,
    library: '@xenova/transformers',
    loaded: embedder !== null
  };
}

export default {
  generateEmbedding,
  generateEmbeddingsBatch,
  cosineSimilarity,
  preloadModel,
  getModelInfo
};
