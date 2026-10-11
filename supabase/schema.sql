-- =============================================================================
-- VoxScribe AI - Supabase Database Setup & Schema
-- Enable vector extensions and create required tables and RPC functions.
-- This script is idempotent: it is safe to re-run on an existing database.
-- =============================================================================

-- 1. Enable vector extension (pgvector) for Retrieval-Augmented Generation (RAG)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. 'voices' table: named Brand Voices per user (e.g. "Personal blog", "Company blog")
CREATE TABLE IF NOT EXISTS public.voices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    style_profile TEXT, -- LLM-generated summary of tone, structure and vocabulary
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS voices_user_id_idx ON public.voices(user_id);

-- 3. 'vault_sources' table: one row per uploaded file, pasted text or imported URL
CREATE TABLE IF NOT EXISTS public.vault_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    voice_id UUID REFERENCES public.voices(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'pdf', -- pdf | docx | txt | md | text | url
    chunk_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS vault_sources_user_id_idx ON public.vault_sources(user_id);

-- 4. 'documents' table: embedded chunks of the user's writing samples
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    embedding vector(384), -- 384 dimensions matching sentence-transformers/all-MiniLM-L6-v2
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.documents
    ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES public.vault_sources(id) ON DELETE CASCADE;
ALTER TABLE public.documents
    ADD COLUMN IF NOT EXISTS voice_id UUID REFERENCES public.voices(id) ON DELETE CASCADE;

-- Index for fast cosine distance vector similarity queries
CREATE INDEX IF NOT EXISTS documents_embedding_idx
ON public.documents
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS documents_user_voice_idx ON public.documents(user_id, voice_id);

-- 5. 'blog_posts' table for saving generated user post history
CREATE TABLE IF NOT EXISTS public.blog_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    youtube_url TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.blog_posts
    ADD COLUMN IF NOT EXISTS voice_id UUID REFERENCES public.voices(id) ON DELETE SET NULL;
ALTER TABLE public.blog_posts
    ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'youtube'; -- youtube | article | text
ALTER TABLE public.blog_posts
    ADD COLUMN IF NOT EXISTS output_format TEXT NOT NULL DEFAULT 'blog'; -- blog | twitter_thread | linkedin | newsletter | show_notes

-- Index on user_id for fast user history lookup
CREATE INDEX IF NOT EXISTS blog_posts_user_id_idx ON public.blog_posts(user_id);

-- 5b. 'transcripts' cache: avoids re-fetching (or re-transcribing) the same YouTube video.
--     Backend-only: RLS is enabled with no policies, so only the service role can access it.
CREATE TABLE IF NOT EXISTS public.transcripts (
    video_id TEXT PRIMARY KEY,
    transcript TEXT NOT NULL,
    timestamped_transcript TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index supporting the per-user daily generation quota
CREATE INDEX IF NOT EXISTS blog_posts_user_created_idx ON public.blog_posts(user_id, created_at DESC);

-- 6. Migration: move chunks uploaded before voices/sources existed into
--    a "Default" voice and an "Earlier uploads" source for each user.
INSERT INTO public.voices (user_id, name)
SELECT DISTINCT d.user_id, 'Default'
FROM public.documents d
WHERE d.voice_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.voices v WHERE v.user_id = d.user_id);

UPDATE public.documents d
SET voice_id = (
    SELECT v.id FROM public.voices v
    WHERE v.user_id = d.user_id
    ORDER BY v.created_at
    LIMIT 1
)
WHERE d.voice_id IS NULL;

WITH new_sources AS (
    INSERT INTO public.vault_sources (user_id, voice_id, name, source_type, chunk_count)
    SELECT d.user_id, d.voice_id, 'Earlier uploads', 'pdf', COUNT(*)
    FROM public.documents d
    WHERE d.source_id IS NULL
    GROUP BY d.user_id, d.voice_id
    RETURNING id, user_id, voice_id
)
UPDATE public.documents d
SET source_id = ns.id
FROM new_sources ns
WHERE d.source_id IS NULL
  AND d.user_id = ns.user_id
  AND d.voice_id IS NOT DISTINCT FROM ns.voice_id;

-- 7. RPC Function for similarity search against vector embeddings
--    match_voice_id = NULL searches across all of the user's voices.
DROP FUNCTION IF EXISTS match_documents(vector, UUID, FLOAT, INT);

CREATE OR REPLACE FUNCTION match_documents(
    query_embedding vector(384),
    match_user_id UUID,
    match_threshold FLOAT DEFAULT 0.0,
    match_count INT DEFAULT 3,
    match_voice_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id,
        d.content,
        1 - (d.embedding <=> query_embedding) AS similarity
    FROM public.documents d
    WHERE d.user_id = match_user_id
      AND (match_voice_id IS NULL OR d.voice_id = match_voice_id)
      AND 1 - (d.embedding <=> query_embedding) > match_threshold
    ORDER BY d.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- match_documents accepts an arbitrary user ID, so only the backend (service role) may call it
REVOKE EXECUTE ON FUNCTION match_documents(vector, UUID, FLOAT, INT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION match_documents(vector, UUID, FLOAT, INT, UUID) TO service_role;

-- 8. Row Level Security
-- The backend uses the service role key (which bypasses RLS) for inserts and vector search.
-- These policies restrict what browser clients using the anon key can see and change.
ALTER TABLE public.voices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own voices" ON public.voices;
CREATE POLICY "Users can read own voices"
ON public.voices FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can read own vault sources" ON public.vault_sources;
CREATE POLICY "Users can read own vault sources"
ON public.vault_sources FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can read own documents" ON public.documents;
CREATE POLICY "Users can read own documents"
ON public.documents FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own documents" ON public.documents;
CREATE POLICY "Users can delete own documents"
ON public.documents FOR DELETE
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can read own blog posts" ON public.blog_posts;
CREATE POLICY "Users can read own blog posts"
ON public.blog_posts FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own blog posts" ON public.blog_posts;
CREATE POLICY "Users can update own blog posts"
ON public.blog_posts FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own blog posts" ON public.blog_posts;
CREATE POLICY "Users can delete own blog posts"
ON public.blog_posts FOR DELETE
TO authenticated
USING (user_id = auth.uid());
