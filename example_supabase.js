/**
 * Beispiel-Skript für Supabase-Integration
 * Zeigt alle Features: Problem hinzufügen, semantische Suche, externe Quellen
 */

import * as supabaseService from './supabaseService.js';
import * as externalSources from './externalSourcesService.js';

console.log('\n=== Supabase + Semantische Suche - Beispiel ===\n');

async function main() {
  try {
    // 1️⃣ Problem mit Embedding hinzufügen
    console.log('1️⃣ Problem mit Embedding hinzufügen...\n');
    
    const problem1 = await supabaseService.addProblemWithEmbedding({
      title: 'Node.js Server Memory Leak',
      description: 'Der Node.js Server verbraucht immer mehr Speicher und stürzt nach einigen Stunden ab. Event-Listener werden nicht ordnungsgemäß entfernt.',
      tags: ['nodejs', 'memory-leak', 'performance']
    });
    
    console.log('Problem 1:', problem1.title, `(ID: ${problem1.id})`);
    console.log();

    const problem2 = await supabaseService.addProblemWithEmbedding({
      title: 'React useState Hook Infinite Loop',
      description: 'useState Hook in useEffect verursacht einen unendlichen Rendering-Loop. Der State wird bei jedem Render neu gesetzt.',
      tags: ['react', 'hooks', 'infinite-loop']
    });
    
    console.log('Problem 2:', problem2.title, `(ID: ${problem2.id})`);
    console.log();

    const problem3 = await supabaseService.addProblemWithEmbedding({
      title: 'PostgreSQL Connection Pool Timeout',
      description: 'Die Datenbankverbindung zum PostgreSQL-Server erreicht das Connection-Limit und neue Verbindungen werden mit Timeout abgelehnt.',
      tags: ['postgresql', 'database', 'connection-pool']
    });
    
    console.log('Problem 3:', problem3.title, `(ID: ${problem3.id})`);
    console.log();

    // 2️⃣ Lösungen hinzufügen
    console.log('2️⃣ Lösungen hinzufügen...\n');
    
    await supabaseService.addSolution({
      problemId: problem1.id,
      description: 'Event-Listener mit removeEventListener() entfernen. Oder WeakMap für automatische Garbage Collection verwenden.',
      source: 'https://nodejs.org/api/events.html'
    });

    await supabaseService.addSolution({
      problemId: problem1.id,
      description: 'Heap Snapshot erstellen und analysieren mit Chrome DevTools oder clinic.js',
      source: 'https://clinicjs.org/'
    });

    await supabaseService.addSolution({
      problemId: problem2.id,
      description: 'Dependency-Array in useEffect richtig setzen. Leeres Array [] für einmalige Ausführung.',
      source: 'https://react.dev/reference/react/useEffect'
    });

    console.log('✓ Lösungen hinzugefügt\n');

    // 3️⃣ Semantische Suche
    console.log('3️⃣ Semantische Suche durchführen...\n');
    
    const searchQuery = 'Speicherprobleme in Node.js beheben';
    console.log(`Query: "${searchQuery}"\n`);
    
    const searchResults = await supabaseService.semanticSearch(searchQuery, 5, 0.1);
    
    console.log(`Gefunden: ${searchResults.length} relevante Probleme\n`);
    
    searchResults.forEach((result, idx) => {
      console.log(`${idx + 1}. ${result.title} (Relevanz: ${result.relevance_score}%)`);
      console.log(`   Beschreibung: ${result.description.substring(0, 80)}...`);
      console.log(`   Lösungen: ${result.solutions ? result.solutions.length : 0}`);
      console.log();
    });

    // 4️⃣ Problem mit Lösungen abrufen
    console.log('4️⃣ Problem mit allen Lösungen abrufen...\n');
    
    const fullProblem = await supabaseService.getProblemWithSolutions(problem1.id);
    console.log(`Problem: ${fullProblem.title}`);
    console.log(`Beschreibung: ${fullProblem.description}`);
    console.log(`\nLösungen (${fullProblem.solutions.length}):`);
    
    fullProblem.solutions.forEach((sol, idx) => {
      console.log(`  ${idx + 1}. ${sol.description.substring(0, 60)}...`);
      if (sol.source) {
        console.log(`     Quelle: ${sol.source}`);
      }
    });
    console.log();

    // 5️⃣ Externe Quellen durchsuchen (Stack Overflow + YouTube)
    console.log('5️⃣ Kombinierte Suche (Intern + Stack Overflow + YouTube)...\n');
    
    const combinedQuery = 'Node.js memory leak detection';
    const combinedResults = await externalSources.searchAllSources(
      combinedQuery,
      supabaseService.semanticSearch,
      {
        internalLimit: 3,
        stackOverflowLimit: 3,
        youtubeLimit: 2
      }
    );

    console.log('=== Kombinierte Ergebnisse ===\n');
    console.log(`Interne DB: ${combinedResults.sources.internal.count} Ergebnisse`);
    console.log(`Stack Overflow: ${combinedResults.sources.stackoverflow.count} Ergebnisse`);
    console.log(`YouTube: ${combinedResults.sources.youtube.count} Ergebnisse`);
    console.log();

    console.log('Top 5 Ergebnisse über alle Quellen:');
    combinedResults.top_results.slice(0, 5).forEach((result, idx) => {
      console.log(`\n${idx + 1}. [${result.source}] ${result.title}`);
      if (result.link) {
        console.log(`   Link: ${result.link}`);
      }
      if (result.relevance_score || result.rank_score) {
        console.log(`   Score: ${result.relevance_score || result.rank_score}`);
      }
    });
    console.log();

    // 6️⃣ Alle Probleme auflisten
    console.log('6️⃣ Alle Probleme in Supabase...\n');
    
    const allProblems = await supabaseService.getAllProblems({ limit: 10 });
    console.log(`Gesamt: ${allProblems.length} Probleme\n`);
    
    allProblems.forEach((p, idx) => {
      console.log(`${idx + 1}. ${p.title}`);
      console.log(`   Tags: ${p.tags ? p.tags.join(', ') : 'keine'}`);
    });
    console.log();

    console.log('=== Beispiel erfolgreich abgeschlossen! ===\n');

  } catch (error) {
    console.error('\n❌ Fehler:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Skript ausführen
main();
