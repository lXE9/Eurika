-- =====================================================
-- Supabase/PostgreSQL Schema für IT-Problems Tracker
-- Mit Embeddings für semantische Suche
-- =====================================================

-- ⚠️ WICHTIG: pgvector Extension MUSS zuerst aktiviert werden!
-- Gehe zu Supabase Dashboard → Database → Extensions
-- Suche nach "vector" und klicke auf "Enable"
-- ODER führe diesen Befehl als Postgres-Superuser aus:

-- Extension für UUID generieren (falls nicht aktiviert)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Extension für pgvector (Embeddings speichern)
-- Falls Fehler: Manuell in Supabase Dashboard aktivieren!
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- Tabelle: problems
-- =====================================================
CREATE TABLE IF NOT EXISTS problems (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL CHECK (char_length(title) > 0),
    description TEXT NOT NULL CHECK (char_length(description) > 0),
    tags TEXT[], -- PostgreSQL Array für Tags
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index für Volltextsuche
CREATE INDEX IF NOT EXISTS idx_problems_search ON problems 
USING gin(to_tsvector('german', title || ' ' || description));

-- Index für Zeitstempel
CREATE INDEX IF NOT EXISTS idx_problems_created_at ON problems(created_at DESC);

-- =====================================================
-- Tabelle: solutions
-- =====================================================
CREATE TABLE IF NOT EXISTS solutions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    description TEXT NOT NULL CHECK (char_length(description) > 0),
    source TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index für Foreign Key
CREATE INDEX IF NOT EXISTS idx_solutions_problem_id ON solutions(problem_id);

-- =====================================================
-- Tabelle: embeddings
-- Speichert Vektor-Embeddings für semantische Suche
-- =====================================================
CREATE TABLE IF NOT EXISTS embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    problem_id UUID NOT NULL UNIQUE REFERENCES problems(id) ON DELETE CASCADE,
    vector vector(384), -- 384 Dimensionen für Sentence Transformers (all-MiniLM-L6-v2)
    model_name TEXT NOT NULL DEFAULT 'tfidf',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index für Vektor-Ähnlichkeitssuche (HNSW für schnelle Cosine-Similarity)
CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON embeddings 
USING hnsw (vector vector_cosine_ops);

-- Index für problem_id
CREATE INDEX IF NOT EXISTS idx_embeddings_problem_id ON embeddings(problem_id);

-- =====================================================
-- Trigger: updated_at automatisch aktualisieren
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger für problems
DROP TRIGGER IF EXISTS update_problems_updated_at ON problems;
CREATE TRIGGER update_problems_updated_at
    BEFORE UPDATE ON problems
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger für solutions
DROP TRIGGER IF EXISTS update_solutions_updated_at ON solutions;
CREATE TRIGGER update_solutions_updated_at
    BEFORE UPDATE ON solutions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger für embeddings
DROP TRIGGER IF EXISTS update_embeddings_updated_at ON embeddings;
CREATE TRIGGER update_embeddings_updated_at
    BEFORE UPDATE ON embeddings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Funktion: Semantische Suche (Cosine Similarity)
-- =====================================================
CREATE OR REPLACE FUNCTION search_similar_problems(
    query_vector vector(384),
    match_threshold FLOAT DEFAULT 0.5,
    match_count INT DEFAULT 5
)
RETURNS TABLE (
    problem_id UUID,
    title TEXT,
    description TEXT,
    tags TEXT[],
    similarity FLOAT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.title,
        p.description,
        p.tags,
        1 - (e.vector <=> query_vector) AS similarity,
        p.created_at
    FROM embeddings e
    INNER JOIN problems p ON e.problem_id = p.id
    WHERE 1 - (e.vector <=> query_vector) > match_threshold
    ORDER BY e.vector <=> query_vector
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- RLS (Row Level Security) - Optional für Multi-Tenancy
-- =====================================================
-- Aktivieren mit: ALTER TABLE problems ENABLE ROW LEVEL SECURITY;
-- Dann Policies erstellen für User-Isolation

-- =====================================================
-- Beispiel-Daten (Optional zum Testen)
-- =====================================================
-- INSERT INTO problems (title, description, tags) VALUES
-- ('Node.js Server startet nicht', 'Nach npm install startet der Server nicht mehr', ARRAY['nodejs', 'npm', 'server']),
-- ('SQLite Database locked', 'Bei gleichzeitigen Schreibzugriffen: database is locked', ARRAY['sqlite', 'database', 'concurrency']),
-- ('React Hooks Fehler', 'useState Hook verursacht infinite loop', ARRAY['react', 'hooks', 'frontend']);

-- =====================================================
-- Nützliche Queries
-- =====================================================

-- Alle Probleme mit Lösungen zählen:
-- SELECT p.id, p.title, COUNT(s.id) as solution_count
-- FROM problems p
-- LEFT JOIN solutions s ON p.id = s.problem_id
-- GROUP BY p.id, p.title;

-- Volltextsuche (ohne Embeddings):
-- SELECT * FROM problems
-- WHERE to_tsvector('german', title || ' ' || description) @@ plainto_tsquery('german', 'Server Fehler');

-- Cosine-Similarity zwischen zwei Embeddings:
-- SELECT 1 - (e1.vector <=> e2.vector) AS similarity
-- FROM embeddings e1, embeddings e2
-- WHERE e1.problem_id = 'uuid1' AND e2.problem_id = 'uuid2';
