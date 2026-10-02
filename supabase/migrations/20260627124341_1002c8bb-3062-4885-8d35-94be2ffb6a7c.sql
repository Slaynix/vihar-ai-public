
-- =========================================================
-- Extensions
-- =========================================================
create extension if not exists vector;
create extension if not exists pg_trgm;

-- =========================================================
-- Enums
-- =========================================================
do $$ begin
  create type public.memory_kind as enum (
    'chat','mentor_msg','voice','note','flashcard','quiz','study_plan',
    'task','goal','habit','water','sleep','calendar','bookmark',
    'upload','document','pdf','image','code','roadmap','ai_answer',
    'search','preference','login','activity','transaction','focus'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.memory_category as enum (
    'knowledge','learning','projects','notes','assignments','voice',
    'chats','study','calendar','goals','health','documents','uploads',
    'bookmarks','activity','archive','favorites','trash','other'
  );
exception when duplicate_object then null; end $$;

-- =========================================================
-- memory_items: the unified Second Brain row
-- =========================================================
create table if not exists public.memory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind public.memory_kind not null,
  category public.memory_category not null default 'other',
  title text not null,
  summary text,
  content text,
  source_table text,
  source_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  pinned boolean not null default false,
  favorite boolean not null default false,
  archived boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.memory_items to authenticated;
grant all on public.memory_items to service_role;

alter table public.memory_items enable row level security;

create policy "own memory" on public.memory_items
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists memory_items_user_created_idx
  on public.memory_items(user_id, created_at desc);
create index if not exists memory_items_user_kind_idx
  on public.memory_items(user_id, kind);
create index if not exists memory_items_user_category_idx
  on public.memory_items(user_id, category);
create index if not exists memory_items_source_idx
  on public.memory_items(source_table, source_id);
create index if not exists memory_items_tags_idx
  on public.memory_items using gin(tags);
create index if not exists memory_items_fts_idx
  on public.memory_items using gin(
    to_tsvector('english', coalesce(title,'') || ' ' || coalesce(summary,'') || ' ' || coalesce(content,''))
  );

create trigger memory_items_touch
  before update on public.memory_items
  for each row execute function public.touch_updated_at();

-- =========================================================
-- memory_embeddings (1536 dims => HNSW-compatible)
-- =========================================================
create table if not exists public.memory_embeddings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  item_id uuid not null references public.memory_items(id) on delete cascade,
  chunk_index int not null default 0,
  chunk_text text not null,
  embedding vector(1536),
  model_version text not null default 'openai/text-embedding-3-small',
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.memory_embeddings to authenticated;
grant all on public.memory_embeddings to service_role;

alter table public.memory_embeddings enable row level security;
create policy "own embeddings" on public.memory_embeddings
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists memory_embeddings_item_idx on public.memory_embeddings(item_id);
create index if not exists memory_embeddings_hnsw_idx
  on public.memory_embeddings using hnsw (embedding vector_cosine_ops);

-- =========================================================
-- memory_versions: edit history
-- =========================================================
create table if not exists public.memory_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  item_id uuid references public.memory_items(id) on delete cascade,
  source_table text not null,
  source_id uuid not null,
  version_no int not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.memory_versions to authenticated;
grant all on public.memory_versions to service_role;

alter table public.memory_versions enable row level security;
create policy "own versions" on public.memory_versions
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists memory_versions_source_idx
  on public.memory_versions(source_table, source_id, version_no desc);

-- =========================================================
-- Tracker tables
-- =========================================================
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  description text,
  target_date date,
  progress_pct int not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.goals to authenticated;
grant all on public.goals to service_role;
alter table public.goals enable row level security;
create policy "own goals" on public.goals for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger goals_touch before update on public.goals
  for each row execute function public.touch_updated_at();

create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  frequency text not null default 'daily',
  streak int not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.habits to authenticated;
grant all on public.habits to service_role;
alter table public.habits enable row level security;
create policy "own habits" on public.habits for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  habit_id uuid not null references public.habits(id) on delete cascade,
  logged_on date not null default current_date,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.habit_logs to authenticated;
grant all on public.habit_logs to service_role;
alter table public.habit_logs enable row level security;
create policy "own habit logs" on public.habit_logs for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  ml int not null,
  logged_at timestamptz not null default now()
);
grant select, insert, update, delete on public.water_logs to authenticated;
grant all on public.water_logs to service_role;
alter table public.water_logs enable row level security;
create policy "own water" on public.water_logs for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  slept_at timestamptz not null,
  woke_at timestamptz not null,
  quality int,
  notes text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.sleep_logs to authenticated;
grant all on public.sleep_logs to service_role;
alter table public.sleep_logs enable row level security;
create policy "own sleep" on public.sleep_logs for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.calendar_events to authenticated;
grant all on public.calendar_events to service_role;
alter table public.calendar_events enable row level security;
create policy "own events" on public.calendar_events for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  url text not null,
  title text,
  notes text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.bookmarks to authenticated;
grant all on public.bookmarks to service_role;
alter table public.bookmarks enable row level security;
create policy "own bookmarks" on public.bookmarks for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  storage_path text not null,
  filename text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.uploads to authenticated;
grant all on public.uploads to service_role;
alter table public.uploads enable row level security;
create policy "own uploads" on public.uploads for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  deck text not null default 'Default',
  front text not null,
  back text not null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.flashcards to authenticated;
grant all on public.flashcards to service_role;
alter table public.flashcards enable row level security;
create policy "own flashcards" on public.flashcards for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  topic text not null,
  questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.quizzes to authenticated;
grant all on public.quizzes to service_role;
alter table public.quizzes enable row level security;
create policy "own quizzes" on public.quizzes for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  event text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.activity_log to authenticated;
grant all on public.activity_log to service_role;
alter table public.activity_log enable row level security;
create policy "own activity" on public.activity_log for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.user_preferences (
  user_id uuid primary key,
  use_memory_rag boolean not null default true,
  voice_enabled boolean not null default true,
  data_jarvis_access boolean not null default true,
  prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.user_preferences to authenticated;
grant all on public.user_preferences to service_role;
alter table public.user_preferences enable row level security;
create policy "own prefs" on public.user_preferences for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger prefs_touch before update on public.user_preferences
  for each row execute function public.touch_updated_at();

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  code text not null,
  title text not null,
  description text,
  earned_at timestamptz not null default now()
);
grant select, insert, update, delete on public.achievements to authenticated;
grant all on public.achievements to service_role;
alter table public.achievements enable row level security;
create policy "own achievements" on public.achievements for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========================================================
-- Helper: upsert memory item from source row
-- =========================================================
create or replace function public.upsert_memory_item(
  _user_id uuid,
  _kind public.memory_kind,
  _category public.memory_category,
  _title text,
  _summary text,
  _content text,
  _source_table text,
  _source_id uuid,
  _metadata jsonb default '{}'::jsonb,
  _tags text[] default '{}'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _id uuid;
begin
  insert into public.memory_items
    (user_id, kind, category, title, summary, content, source_table, source_id, metadata, tags)
  values
    (_user_id, _kind, _category, _title, _summary, _content, _source_table, _source_id, coalesce(_metadata,'{}'::jsonb), coalesce(_tags,'{}'))
  on conflict do nothing
  returning id into _id;
  return _id;
end $$;

-- =========================================================
-- Auto-capture triggers (mirror into memory_items)
-- =========================================================

-- notes
create or replace function public.mirror_note_to_memory()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.upsert_memory_item(
    NEW.user_id, 'note', 'notes', NEW.topic,
    left(coalesce(NEW.content,''), 240),
    NEW.content, 'notes', NEW.id,
    jsonb_build_object('topic', NEW.topic), array[]::text[]
  );
  return NEW;
end $$;

drop trigger if exists notes_to_memory on public.notes;
create trigger notes_to_memory after insert on public.notes
  for each row execute function public.mirror_note_to_memory();

-- messages (assistant + user)
create or replace function public.mirror_message_to_memory()
returns trigger language plpgsql security definer set search_path = public as $$
declare _text text;
begin
  begin
    select string_agg(coalesce(p->>'text',''), E'\n')
    into _text
    from jsonb_array_elements(NEW.parts) p
    where p->>'type' = 'text';
  exception when others then _text := null; end;
  if _text is null or length(trim(_text)) = 0 then
    return NEW;
  end if;
  perform public.upsert_memory_item(
    NEW.user_id,
    case when NEW.role = 'assistant' then 'mentor_msg'::public.memory_kind else 'chat'::public.memory_kind end,
    'chats', left(_text, 80),
    left(_text, 240), _text, 'messages', NEW.id,
    jsonb_build_object('thread_id', NEW.thread_id, 'role', NEW.role),
    array[]::text[]
  );
  return NEW;
end $$;

drop trigger if exists messages_to_memory on public.messages;
create trigger messages_to_memory after insert on public.messages
  for each row execute function public.mirror_message_to_memory();

-- tasks
create or replace function public.mirror_task_to_memory()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.upsert_memory_item(
    NEW.user_id, 'task', 'learning', NEW.title,
    coalesce(NEW.notes, ''), NEW.notes, 'tasks', NEW.id,
    jsonb_build_object('priority', NEW.priority, 'status', NEW.status, 'due_date', NEW.due_date),
    array[]::text[]
  );
  return NEW;
end $$;
drop trigger if exists tasks_to_memory on public.tasks;
create trigger tasks_to_memory after insert on public.tasks
  for each row execute function public.mirror_task_to_memory();

-- roadmaps
create or replace function public.mirror_roadmap_to_memory()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.upsert_memory_item(
    NEW.user_id, 'roadmap', 'projects', NEW.goal,
    'Roadmap: ' || NEW.goal, coalesce(NEW.steps->>'content',''), 'roadmaps', NEW.id,
    NEW.steps, array[]::text[]
  );
  return NEW;
end $$;
drop trigger if exists roadmaps_to_memory on public.roadmaps;
create trigger roadmaps_to_memory after insert on public.roadmaps
  for each row execute function public.mirror_roadmap_to_memory();

-- transactions
create or replace function public.mirror_tx_to_memory()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.upsert_memory_item(
    NEW.user_id, 'transaction', 'activity',
    NEW.kind || ': ' || NEW.amount::text || coalesce(' — ' || NEW.category, ''),
    NEW.note, NEW.note, 'transactions', NEW.id,
    jsonb_build_object('kind', NEW.kind, 'amount', NEW.amount, 'category', NEW.category, 'occurred_on', NEW.occurred_on),
    array[]::text[]
  );
  return NEW;
end $$;
drop trigger if exists transactions_to_memory on public.transactions;
create trigger transactions_to_memory after insert on public.transactions
  for each row execute function public.mirror_tx_to_memory();

-- focus_sessions
create or replace function public.mirror_focus_to_memory()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.upsert_memory_item(
    NEW.user_id, 'focus', 'study',
    'Focus: ' || coalesce(NEW.label, 'session') || ' · ' || NEW.duration_min::text || 'm',
    null, NEW.label, 'focus_sessions', NEW.id,
    jsonb_build_object('duration_min', NEW.duration_min, 'label', NEW.label),
    array[]::text[]
  );
  return NEW;
end $$;
drop trigger if exists focus_to_memory on public.focus_sessions;
create trigger focus_to_memory after insert on public.focus_sessions
  for each row execute function public.mirror_focus_to_memory();

-- goals
create or replace function public.mirror_goal_to_memory()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.upsert_memory_item(
    NEW.user_id, 'goal', 'goals', NEW.title,
    NEW.description, NEW.description, 'goals', NEW.id,
    jsonb_build_object('progress_pct', NEW.progress_pct, 'status', NEW.status, 'target_date', NEW.target_date),
    array[]::text[]
  );
  return NEW;
end $$;
drop trigger if exists goals_to_memory on public.goals;
create trigger goals_to_memory after insert on public.goals
  for each row execute function public.mirror_goal_to_memory();

-- bookmarks
create or replace function public.mirror_bookmark_to_memory()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.upsert_memory_item(
    NEW.user_id, 'bookmark', 'bookmarks',
    coalesce(NEW.title, NEW.url), NEW.notes, NEW.notes, 'bookmarks', NEW.id,
    jsonb_build_object('url', NEW.url), NEW.tags
  );
  return NEW;
end $$;
drop trigger if exists bookmarks_to_memory on public.bookmarks;
create trigger bookmarks_to_memory after insert on public.bookmarks
  for each row execute function public.mirror_bookmark_to_memory();

-- uploads
create or replace function public.mirror_upload_to_memory()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.upsert_memory_item(
    NEW.user_id,
    case when NEW.mime_type ilike 'image/%' then 'image'::public.memory_kind
         when NEW.mime_type ilike '%pdf%' then 'pdf'::public.memory_kind
         else 'upload'::public.memory_kind end,
    'uploads', NEW.filename, NEW.mime_type, null, 'uploads', NEW.id,
    jsonb_build_object('storage_path', NEW.storage_path, 'mime', NEW.mime_type, 'size', NEW.size_bytes),
    array[]::text[]
  );
  return NEW;
end $$;
drop trigger if exists uploads_to_memory on public.uploads;
create trigger uploads_to_memory after insert on public.uploads
  for each row execute function public.mirror_upload_to_memory();

-- flashcards
create or replace function public.mirror_flashcard_to_memory()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.upsert_memory_item(
    NEW.user_id, 'flashcard', 'learning',
    NEW.deck || ': ' || left(NEW.front, 60),
    NEW.front, NEW.front || E'\n---\n' || NEW.back,
    'flashcards', NEW.id, jsonb_build_object('deck', NEW.deck), array[]::text[]
  );
  return NEW;
end $$;
drop trigger if exists flashcards_to_memory on public.flashcards;
create trigger flashcards_to_memory after insert on public.flashcards
  for each row execute function public.mirror_flashcard_to_memory();

-- quizzes
create or replace function public.mirror_quiz_to_memory()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.upsert_memory_item(
    NEW.user_id, 'quiz', 'learning', 'Quiz: ' || NEW.topic,
    null, NEW.questions::text, 'quizzes', NEW.id,
    jsonb_build_object('topic', NEW.topic), array[]::text[]
  );
  return NEW;
end $$;
drop trigger if exists quizzes_to_memory on public.quizzes;
create trigger quizzes_to_memory after insert on public.quizzes
  for each row execute function public.mirror_quiz_to_memory();

-- calendar
create or replace function public.mirror_calendar_to_memory()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.upsert_memory_item(
    NEW.user_id, 'calendar', 'calendar', NEW.title,
    NEW.description, NEW.description, 'calendar_events', NEW.id,
    jsonb_build_object('starts_at', NEW.starts_at, 'ends_at', NEW.ends_at, 'location', NEW.location),
    array[]::text[]
  );
  return NEW;
end $$;
drop trigger if exists calendar_to_memory on public.calendar_events;
create trigger calendar_to_memory after insert on public.calendar_events
  for each row execute function public.mirror_calendar_to_memory();

-- =========================================================
-- Version snapshots for notes / roadmaps / goals
-- =========================================================
create or replace function public.snapshot_version()
returns trigger language plpgsql security definer set search_path = public as $$
declare _next int;
begin
  select coalesce(max(version_no),0)+1 into _next
    from public.memory_versions
    where source_table = TG_TABLE_NAME and source_id = OLD.id;
  insert into public.memory_versions (user_id, source_table, source_id, version_no, snapshot)
    values (OLD.user_id, TG_TABLE_NAME, OLD.id, _next, to_jsonb(OLD));
  return NEW;
end $$;

drop trigger if exists notes_version on public.notes;
create trigger notes_version before update on public.notes
  for each row execute function public.snapshot_version();

drop trigger if exists roadmaps_version on public.roadmaps;
create trigger roadmaps_version before update on public.roadmaps
  for each row execute function public.snapshot_version();

drop trigger if exists goals_version on public.goals;
create trigger goals_version before update on public.goals
  for each row execute function public.snapshot_version();

-- =========================================================
-- Semantic + hybrid search
-- =========================================================
create or replace function public.match_memories(
  _user_id uuid,
  _query_embedding vector(1536),
  _kinds public.memory_kind[] default null,
  _since timestamptz default null,
  _until timestamptz default null,
  _limit int default 10
)
returns table (
  item_id uuid,
  title text,
  summary text,
  kind public.memory_kind,
  category public.memory_category,
  created_at timestamptz,
  similarity float,
  chunk text
)
language sql stable security definer set search_path = public as $$
  select
    mi.id as item_id,
    mi.title,
    mi.summary,
    mi.kind,
    mi.category,
    mi.created_at,
    1 - (me.embedding <=> _query_embedding) as similarity,
    me.chunk_text as chunk
  from public.memory_embeddings me
  join public.memory_items mi on mi.id = me.item_id
  where me.user_id = _user_id
    and mi.deleted_at is null
    and mi.archived = false
    and (_kinds is null or mi.kind = any(_kinds))
    and (_since is null or mi.created_at >= _since)
    and (_until is null or mi.created_at <= _until)
  order by me.embedding <=> _query_embedding
  limit _limit
$$;

-- =========================================================
-- Storage bucket via storage API not allowed in SQL — handled separately
-- =========================================================
