CREATE TABLE public.resource_search_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic text NOT NULL,
  searched_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.resource_search_history TO authenticated;
GRANT ALL ON public.resource_search_history TO service_role;

ALTER TABLE public.resource_search_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own search history"
  ON public.resource_search_history FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add their own search history"
  ON public.resource_search_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can clear their own search history"
  ON public.resource_search_history FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX resource_search_history_user_searched_idx
  ON public.resource_search_history (user_id, searched_at DESC);