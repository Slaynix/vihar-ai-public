
-- Ensure authenticated can read their own roles (needed once has_role is SECURITY INVOKER)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_roles' AND policyname='Users can read their own roles'
  ) THEN
    CREATE POLICY "Users can read their own roles"
      ON public.user_roles
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Convert has_role to SECURITY INVOKER. RLS on user_roles restricts to the caller's own rows,
-- which is the only way this function is invoked (has_role(auth.uid(), ...) inside policies).
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Convert match_memories to SECURITY INVOKER. RLS on memory_embeddings/memory_items already
-- scopes rows to auth.uid(), so callers can only ever retrieve their own memories.
CREATE OR REPLACE FUNCTION public.match_memories(
  _user_id uuid,
  _query_embedding vector,
  _kinds public.memory_kind[] DEFAULT NULL,
  _since timestamptz DEFAULT NULL,
  _until timestamptz DEFAULT NULL,
  _limit integer DEFAULT 10
)
RETURNS TABLE(
  item_id uuid,
  title text,
  summary text,
  kind public.memory_kind,
  category public.memory_category,
  created_at timestamptz,
  similarity double precision,
  chunk text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    mi.id AS item_id,
    mi.title,
    mi.summary,
    mi.kind,
    mi.category,
    mi.created_at,
    1 - (me.embedding <=> _query_embedding) AS similarity,
    me.chunk_text AS chunk
  FROM public.memory_embeddings me
  JOIN public.memory_items mi ON mi.id = me.item_id
  WHERE me.user_id = _user_id
    AND mi.deleted_at IS NULL
    AND mi.archived = false
    AND (_kinds IS NULL OR mi.kind = ANY(_kinds))
    AND (_since IS NULL OR mi.created_at >= _since)
    AND (_until IS NULL OR mi.created_at <= _until)
  ORDER BY me.embedding <=> _query_embedding
  LIMIT _limit
$$;
