ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'study';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS duration_min integer NOT NULL DEFAULT 30;

CREATE TABLE public.internship_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  company text NOT NULL,
  url text NOT NULL,
  location text,
  work_mode text,
  employment_type text,
  stipend text,
  source text,
  description text,
  status text NOT NULL DEFAULT 'saved',
  notes text,
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.internship_applications TO authenticated;
GRANT ALL ON public.internship_applications TO service_role;
ALTER TABLE public.internship_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own internship applications" ON public.internship_applications FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX internship_applications_user_status_idx ON public.internship_applications (user_id, status, created_at DESC);