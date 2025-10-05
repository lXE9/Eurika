/**
 * Service für externe Quellen-Suche
 * Stack Overflow und YouTube API Integration
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// API-Keys aus .env (optional)
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const STACK_OVERFLOW_KEY = process.env.STACK_OVERFLOW_KEY; // Optional, erhöht Rate-Limit

/**
 * 🔍 Stack Overflow durchsuchen
 * @param {string} query - Suchanfrage
 * @param {number} [limit=5] - Max. Anzahl der Ergebnisse
 * @returns {Array} Stack Overflow Fragen
 */
export async function searchStackOverflow(query, limit = 5) {
  try {
    if (!query || typeof query !== 'string') {
      throw new Error('Query muss ein nicht-leerer String sein');
    }

    console.log(`🔍 Stack Overflow-Suche: "${query}"`);

    // Stack Exchange API v2.3
    const params = {
      order: 'desc',
      sort: 'relevance',
      intitle: query,
      site: 'stackoverflow',
      pagesize: limit,
      filter: 'withbody' // Inkl. Body-Text
    };

    // Optional: API-Key für höheres Rate-Limit
    if (STACK_OVERFLOW_KEY) {
      params.key = STACK_OVERFLOW_KEY;
    }

    const response = await axios.get('https://api.stackexchange.com/2.3/search/advanced', {
      params,
      headers: {
        'Accept-Encoding': 'gzip'
      },
      timeout: 10000
    });

    if (!response.data || !response.data.items) {
      return [];
    }

    // Daten formatieren
    const results = response.data.items.map(item => ({
      source: 'stackoverflow',
      title: item.title,
      link: item.link,
      score: item.score,
      answer_count: item.answer_count,
      view_count: item.view_count,
      is_answered: item.is_answered,
      tags: item.tags,
      creation_date: new Date(item.creation_date * 1000).toISOString(),
      excerpt: item.body ? item.body.substring(0, 200).replace(/<[^>]*>/g, '') + '...' : '',
      relevance_score: calculateStackOverflowRelevance(item)
    }));

    // Nach Relevanz sortieren
    results.sort((a, b) => b.relevance_score - a.relevance_score);

    console.log(`✓ ${results.length} Stack Overflow Ergebnisse gefunden`);
    return results;

  } catch (error) {
    console.error('✗ Fehler bei Stack Overflow-Suche:', error.message);
    
    // Rate-Limit erreicht?
    if (error.response && error.response.status === 429) {
      console.warn('⚠️ Stack Overflow Rate-Limit erreicht');
    }
    
    return []; // Leeres Array zurückgeben statt zu werfen
  }
}

/**
 * Relevanz-Score für Stack Overflow-Frage berechnen
 * @private
 */
function calculateStackOverflowRelevance(item) {
  let score = 0;
  
  // Basiswertung
  score += item.score * 5; // Vote-Score
  score += item.answer_count * 10; // Anzahl Antworten
  
  // Bonus für beantwortete Fragen
  if (item.is_answered) {
    score += 20;
  }
  
  // Bonus für akzeptierte Antwort
  if (item.accepted_answer_id) {
    score += 30;
  }
  
  // Views (logarithmisch, um nicht zu dominieren)
  score += Math.log10(item.view_count + 1) * 5;
  
  // Aktualität (neuere Fragen bevorzugen)
  const ageInDays = (Date.now() - item.creation_date * 1000) / (1000 * 60 * 60 * 24);
  if (ageInDays < 365) {
    score += 10;
  }
  
  return Math.round(score);
}

/**
 * 🎥 YouTube durchsuchen
 * @param {string} query - Suchanfrage
 * @param {number} [limit=5] - Max. Anzahl der Ergebnisse
 * @returns {Array} YouTube Videos
 */
export async function searchYouTube(query, limit = 5) {
  try {
    if (!query || typeof query !== 'string') {
      throw new Error('Query muss ein nicht-leerer String sein');
    }

    if (!YOUTUBE_API_KEY) {
      console.warn('⚠️ YOUTUBE_API_KEY nicht in .env definiert - YouTube-Suche übersprungen');
      return [];
    }

    console.log(`🎥 YouTube-Suche: "${query}"`);

    // YouTube Data API v3
    const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        q: query,
        type: 'video',
        maxResults: limit,
        order: 'relevance',
        key: YOUTUBE_API_KEY,
        relevanceLanguage: 'de', // Bevorzuge deutsche Videos
        safeSearch: 'none'
      },
      timeout: 10000
    });

    if (!response.data || !response.data.items) {
      return [];
    }

    // Daten formatieren
    const results = response.data.items.map(item => ({
      source: 'youtube',
      title: item.snippet.title,
      description: item.snippet.description,
      link: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      video_id: item.id.videoId,
      channel: item.snippet.channelTitle,
      channel_id: item.snippet.channelId,
      published_at: item.snippet.publishedAt,
      thumbnail: item.snippet.thumbnails.medium.url
    }));

    console.log(`✓ ${results.length} YouTube Ergebnisse gefunden`);
    return results;

  } catch (error) {
    console.error('✗ Fehler bei YouTube-Suche:', error.message);
    
    // Quota überschritten?
    if (error.response && error.response.status === 403) {
      console.warn('⚠️ YouTube API Quota überschritten');
    }
    
    return []; // Leeres Array zurückgeben statt zu werfen
  }
}

/**
 * 🌐 Kombinierte Suche: Supabase + Stack Overflow + YouTube
 * @param {string} query - Suchanfrage
 * @param {Function} supabaseSearchFn - Supabase-Suchfunktion
 * @param {Object} [options] - Optionen
 * @param {number} [options.internalLimit=5] - Max. interne Ergebnisse
 * @param {number} [options.stackOverflowLimit=3] - Max. Stack Overflow Ergebnisse
 * @param {number} [options.youtubeLimit=2] - Max. YouTube Ergebnisse
 * @returns {Object} Kombinierte Ergebnisse
 */
export async function searchAllSources(
  query,
  supabaseSearchFn,
  { internalLimit = 5, stackOverflowLimit = 3, youtubeLimit = 2 } = {}
) {
  try {
    if (!query || typeof query !== 'string') {
      throw new Error('Query muss ein nicht-leerer String sein');
    }

    console.log(`\n🔎 Kombinierte Suche: "${query}"\n`);

    // Parallele Suche in allen Quellen
    const [internalResults, stackOverflowResults, youtubeResults] = await Promise.allSettled([
      supabaseSearchFn(query, internalLimit),
      searchStackOverflow(query, stackOverflowLimit),
      searchYouTube(query, youtubeLimit)
    ]);

    // Ergebnisse extrahieren (auch bei Fehlern)
    const internal = internalResults.status === 'fulfilled' ? internalResults.value : [];
    const stackoverflow = stackOverflowResults.status === 'fulfilled' ? stackOverflowResults.value : [];
    const youtube = youtubeResults.status === 'fulfilled' ? youtubeResults.value : [];

    // Kombinierte Ergebnisse
    const combined = {
      query,
      timestamp: new Date().toISOString(),
      total_results: internal.length + stackoverflow.length + youtube.length,
      sources: {
        internal: {
          count: internal.length,
          results: internal.map(item => ({
            ...item,
            source: 'internal_db'
          }))
        },
        stackoverflow: {
          count: stackoverflow.length,
          results: stackoverflow
        },
        youtube: {
          count: youtube.length,
          results: youtube
        }
      },
      // Top-Ergebnisse über alle Quellen
      top_results: combineAndRankResults(internal, stackoverflow, youtube)
    };

    console.log(`\n✓ Gesamtergebnisse: ${combined.total_results}`);
    console.log(`  - Interne DB: ${internal.length}`);
    console.log(`  - Stack Overflow: ${stackoverflow.length}`);
    console.log(`  - YouTube: ${youtube.length}\n`);

    return combined;

  } catch (error) {
    console.error('✗ Fehler bei kombinierter Suche:', error.message);
    throw error;
  }
}

/**
 * Ergebnisse kombinieren und nach Relevanz ranken
 * @private
 */
function combineAndRankResults(internal, stackoverflow, youtube) {
  const all = [];

  // Interne Ergebnisse (höchste Priorität)
  internal.forEach(item => {
    all.push({
      ...item,
      source: 'internal_db',
      rank_score: (item.relevance_score || item.similarity * 100) + 100 // Bonus für interne Ergebnisse
    });
  });

  // Stack Overflow
  stackoverflow.forEach(item => {
    all.push({
      ...item,
      rank_score: item.relevance_score
    });
  });

  // YouTube (niedrigste Priorität)
  youtube.forEach(item => {
    all.push({
      ...item,
      rank_score: 30 // Fixer Score, da keine Relevanz-Metrik
    });
  });

  // Nach Rank-Score sortieren
  all.sort((a, b) => b.rank_score - a.rank_score);

  return all.slice(0, 10); // Top 10
}

/**
 * 🔗 Links aus allen Quellen extrahieren
 * @param {Object} searchResults - Ergebnis von searchAllSources
 * @returns {Array<string>} Array von URLs
 */
export function extractAllLinks(searchResults) {
  const links = [];

  // Interne DB-Links
  searchResults.sources.internal.results.forEach(item => {
    if (item.solutions && item.solutions.length > 0) {
      item.solutions.forEach(sol => {
        if (sol.source) {
          links.push(sol.source);
        }
      });
    }
  });

  // Stack Overflow
  searchResults.sources.stackoverflow.results.forEach(item => {
    links.push(item.link);
  });

  // YouTube
  searchResults.sources.youtube.results.forEach(item => {
    links.push(item.link);
  });

  return [...new Set(links)]; // Duplikate entfernen
}

export default {
  searchStackOverflow,
  searchYouTube,
  searchAllSources,
  extractAllLinks
};
