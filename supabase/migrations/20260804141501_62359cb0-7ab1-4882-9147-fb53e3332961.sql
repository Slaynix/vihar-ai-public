CREATE TABLE public.resource_searches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  topic text NOT NULL UNIQUE,
  results jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT ON public.resource_searches TO authenticated;
GRANT ALL ON public.resource_searches TO service_role;
ALTER TABLE public.resource_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can read cached searches"
  ON public.resource_searches FOR SELECT TO authenticated USING (true);

CREATE TABLE public.resource_bookmarks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic text,
  title text NOT NULL,
  url text NOT NULL,
  source text,
  kind text NOT NULL DEFAULT 'article',
  thumbnail text,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, url)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resource_bookmarks TO authenticated;
GRANT ALL ON public.resource_bookmarks TO service_role;
ALTER TABLE public.resource_bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own resource bookmarks"
  ON public.resource_bookmarks FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_resource_searches_updated_at BEFORE UPDATE ON public.resource_searches
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER update_resource_bookmarks_updated_at BEFORE UPDATE ON public.resource_bookmarks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();