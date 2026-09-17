-- Receipt/bill photos. Objects live at receipts/<brand_id>/<file>, and the
-- first path segment decides access, mirroring the per-brand table policies.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
on conflict (id) do nothing;

create or replace function receipt_brand(object_name text)
returns uuid language plpgsql immutable as $$
begin
  return (storage.foldername(object_name))[1]::uuid;
exception when others then
  return null;
end $$;

create policy receipts_read on storage.objects for select
  using (bucket_id = 'receipts' and has_brand_access(receipt_brand(name)));

create policy receipts_insert on storage.objects for insert
  with check (bucket_id = 'receipts' and has_brand_access(receipt_brand(name)));

create policy receipts_delete on storage.objects for delete
  using (bucket_id = 'receipts' and has_brand_access(receipt_brand(name)));
