-- 1. Create ai_media bucket if it does not exist
insert into storage.buckets (id, name, public)
select 'ai_media', 'ai_media', true
where not exists (
  select 1 from storage.buckets where id = 'ai_media'
);

-- 2. Create RLS Policies for ai_media
-- Allow public access to read files
create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'ai_media' );

-- Allow authenticated users to insert files
create policy "Auth Insert"
  on storage.objects for insert
  to authenticated
  with check ( bucket_id = 'ai_media' );

-- Allow users to update their own files
create policy "Auth Update"
  on storage.objects for update
  to authenticated
  using ( bucket_id = 'ai_media' and owner = auth.uid() );

-- Allow users to delete their own files
create policy "Auth Delete"
  on storage.objects for delete
  to authenticated
  using ( bucket_id = 'ai_media' and owner = auth.uid() );
