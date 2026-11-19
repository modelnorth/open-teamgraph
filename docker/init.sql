-- Open TeamGraph Apache AGE & pgvector Initialization Script

CREATE EXTENSION IF NOT EXISTS age;
CREATE EXTENSION IF NOT EXISTS vector;

LOAD 'age';
SET search_path = ag_catalog, "$user", public;

-- Initialize graph namespace
SELECT create_graph('teamgraph');

-- Canonical table for raw entity fast-lookup & embeddings
CREATE TABLE IF NOT EXISTS entity_embeddings (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    name TEXT NOT NULL,
    embedding vector(1536),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entity_embeddings_type ON entity_embeddings(entity_type);
CREATE INDEX IF NOT EXISTS idx_entity_embeddings_vector ON entity_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
