
revoke execute on function public.upsert_memory_item(uuid, public.memory_kind, public.memory_category, text, text, text, text, uuid, jsonb, text[]) from public, anon, authenticated;
revoke execute on function public.mirror_note_to_memory() from public, anon, authenticated;
revoke execute on function public.mirror_message_to_memory() from public, anon, authenticated;
revoke execute on function public.mirror_task_to_memory() from public, anon, authenticated;
revoke execute on function public.mirror_roadmap_to_memory() from public, anon, authenticated;
revoke execute on function public.mirror_tx_to_memory() from public, anon, authenticated;
revoke execute on function public.mirror_focus_to_memory() from public, anon, authenticated;
revoke execute on function public.mirror_goal_to_memory() from public, anon, authenticated;
revoke execute on function public.mirror_bookmark_to_memory() from public, anon, authenticated;
revoke execute on function public.mirror_upload_to_memory() from public, anon, authenticated;
revoke execute on function public.mirror_flashcard_to_memory() from public, anon, authenticated;
revoke execute on function public.mirror_quiz_to_memory() from public, anon, authenticated;
revoke execute on function public.mirror_calendar_to_memory() from public, anon, authenticated;
revoke execute on function public.snapshot_version() from public, anon, authenticated;
-- match_memories should be callable by authenticated users (RPC); keep grant
grant execute on function public.match_memories(uuid, vector, public.memory_kind[], timestamptz, timestamptz, int) to authenticated, service_role;
