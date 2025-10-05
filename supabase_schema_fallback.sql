-- =====================================================
-- Supabase Schema OHNE pgvector (Fallback)
-- Für Supabase Free Tier ohne pgvector-Support
-- =====================================================

-- Extension für UUID generieren
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- Tabelle: problems
-- =====================================================
CREATE TABLE IF NOT EXISTS problems (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL CHECK (char_length(title) > 0),
    description TEXT NOT NULL CHECK (char_length(description) > 0),
    tags TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_problems_search ON problems 
USING gin(to_tsvector('german', title || ' ' || description));

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

CREATE INDEX IF NOT EXISTS idx_solutions_problem_id ON solutions(problem_id);

-- =====================================================
-- Tabelle: embeddings (JSON statt vector)
-- =====================================================
CREATE TABLE IF NOT EXISTS embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    problem_id UUID NOT NULL UNIQUE REFERENCES problems(id) ON DELETE CASCADE,
    vector JSONB NOT NULL, -- JSON-Array statt vector-Typ
    model_name TEXT NOT NULL DEFAULT 'tfidf',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

DROP TRIGGER IF EXISTS update_problems_updated_at ON problems;
CREATE TRIGGER update_problems_updated_at
    BEFORE UPDATE ON problems
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_solutions_updated_at ON solutions;
CREATE TRIGGER update_solutions_updated_at
    BEFORE UPDATE ON solutions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_embeddings_updated_at ON embeddings;
CREATE TRIGGER update_embeddings_updated_at
    BEFORE UPDATE ON embeddings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Hinweis: Semantische Suche
-- =====================================================
-- WICHTIG: Ohne pgvector muss die Cosine-Similarity
-- in der Node.js-Anwendung berechnet werden!
-- 
-- 1. Alle Embeddings abrufen:
--    SELECT problem_id, vector FROM embeddings;
--
-- 2. In Node.js Similarity berechnen:
--    const similarities = embeddings.map(e => ({
--      problem_id: e.problem_id,
--      similarity: cosineSimilarity(queryVector, e.vector)
--    }));
--
-- 3. Sortieren und Top-N nehmen:
--    similarities.sort((a,b) => b.similarity - a.similarity)
--                .slice(0, limit);
