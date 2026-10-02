
-- Revoke EXECUTE from public roles on SECURITY DEFINER functions.
-- Trigger functions do not need EXECUTE grants to fire from triggers.
REVOKE EXECUTE ON FUNCTION public.mirror_bookmark_to_memory() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mirror_upload_to_memory() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mirror_flashcard_to_memory() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mirror_focus_to_memory() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mirror_goal_to_memory() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mirror_note_to_memory() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mirror_message_to_memory() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mirror_task_to_memory() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mirror_tx_to_memory() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mirror_quiz_to_memory() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mirror_calendar_to_memory() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mirror_roadmap_to_memory() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.snapshot_version() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.upsert_memory_item(uuid, public.memory_kind, public.memory_category, text, text, text, text, uuid, jsonb, text[]) FROM PUBLIC, anon, authenticated;

-- has_role and match_memories are called at runtime by signed-in users
-- (via RLS policies and RPC). Restrict to authenticated only.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.match_memories(uuid, public.vector, public.memory_kind[], timestamptz, timestamptz, integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.match_memories(uuid, public.vector, public.memory_kind[], timestamptz, timestamptz, integer) TO authenticated;
