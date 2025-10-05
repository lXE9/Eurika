/**
 * Migrations-Skript: TF-IDF → all-MiniLM-L6-v2
 * Regeneriert alle Embeddings mit dem neuen Modell
 */

import { supabase } from './supabaseClient.js';
import { generateEmbedding } from './embeddingService.js';

async function migrateEmbeddings() {
  console.log('\n╔════════════════════════════════════════════════╗');
  console.log('║  Embedding-Migration: TF-IDF → all-MiniLM-L6-v2 ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  try {
    // Schritt 1: Alle Probleme abrufen
    console.log('📋 Schritt 1: Probleme aus Supabase abrufen...');
    const { data: problems, error: problemsError } = await supabase
      .from('problems')
      .select('id, title, description');

    if (problemsError) {
      throw new Error(`Fehler beim Abrufen der Probleme: ${problemsError.message}`);
    }

    if (!problems || problems.length === 0) {
      console.log('ℹ️  Keine Probleme gefunden. Migration nicht erforderlich.\n');
      return;
    }

    console.log(`✓ ${problems.length} Probleme gefunden\n`);

    // Schritt 2: Alle alten Embeddings löschen
    console.log('🗑️  Schritt 2: Alle bestehenden Embeddings löschen...');
    const { error: deleteError, count } = await supabase
      .from('embeddings')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Löscht alle

    if (deleteError) {
      console.warn('⚠️  Warnung beim Löschen alter Embeddings:', deleteError.message);
    } else {
      console.log(`✓ ${count || 'Alle'} Embeddings gelöscht\n`);
    }

    // Schritt 3: Neue Embeddings generieren
    console.log('🔄 Schritt 3: Neue Embeddings mit all-MiniLM-L6-v2 generieren...\n');
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (let i = 0; i < problems.length; i++) {
      const problem = problems[i];
      const progress = `[${i + 1}/${problems.length}]`;
      
      try {
        console.log(`${progress} Problem: ${problem.title.substring(0, 50)}...`);
        
        // Embedding generieren
        const textForEmbedding = `${problem.title} ${problem.description}`;
        const startTime = Date.now();
        const embedding = await generateEmbedding(textForEmbedding);
        const duration = Date.now() - startTime;
        
        console.log(`  ⏱️  Embedding generiert in ${duration}ms (${embedding.length} Dim)`);
        
        // In Datenbank speichern (UPSERT: Update oder Insert)
        const { error: insertError } = await supabase
          .from('embeddings')
          .upsert({
            problem_id: problem.id,
            vector: embedding,
            model_name: 'all-MiniLM-L6-v2'
          }, {
            onConflict: 'problem_id' // Bei Konflikt: Update statt Fehler
          });

        if (insertError) {
          throw new Error(insertError.message);
        }

        console.log(`  ✅ Erfolgreich gespeichert\n`);
        successCount++;
        
      } catch (error) {
        console.error(`  ❌ Fehler: ${error.message}\n`);
        errorCount++;
        errors.push({
          problemId: problem.id,
          title: problem.title,
          error: error.message
        });
      }
    }

    // Zusammenfassung
    console.log('╔════════════════════════════════════════╗');
    console.log('║         MIGRATIONS-ERGEBNIS            ║');
    console.log('╚════════════════════════════════════════╝\n');
    console.log(`✅ Erfolgreich: ${successCount}/${problems.length}`);
    console.log(`❌ Fehler:      ${errorCount}/${problems.length}`);
    
    if (errorCount > 0) {
      console.log('\n⚠️  Fehlerhafte Probleme:');
      errors.forEach(err => {
        console.log(`  - ${err.title} (${err.problemId})`);
        console.log(`    ${err.error}`);
      });
    }
    
    console.log('\n🎉 Migration abgeschlossen!\n');

  } catch (error) {
    console.error('\n❌ Kritischer Fehler bei der Migration:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Migration starten
console.log('⚠️  WICHTIG: Dieses Skript löscht alle alten Embeddings und erstellt sie neu!');
console.log('⏳ Geschätzte Dauer: ~500ms pro Problem');
console.log('💾 Stelle sicher, dass Supabase erreichbar ist.\n');

// Sicherheits-Delay (Zeit zum Abbrechen mit Ctrl+C)
console.log('🕐 Starte in 3 Sekunden... (Ctrl+C zum Abbrechen)');
await new Promise(resolve => setTimeout(resolve, 3000));

migrateEmbeddings()
  .then(() => {
    console.log('✅ Skript erfolgreich beendet');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Skript mit Fehler beendet:', error);
    process.exit(1);
  });
