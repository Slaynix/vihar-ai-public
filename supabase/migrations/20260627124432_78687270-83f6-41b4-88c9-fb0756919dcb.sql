
create policy "own memory uploads read" on storage.objects
  for select to authenticated
  using (bucket_id = 'memory-uploads' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "own memory uploads insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'memory-uploads' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "own memory uploads update" on storage.objects
  for update to authenticated
  using (bucket_id = 'memory-uploads' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'memory-uploads' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "own memory uploads delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'memory-uploads' and auth.uid()::text = (storage.foldername(name))[1]);
