-- Access control hardening:
--  * signup is invite-only (strangers get a profile with no company)
--  * users cannot change their own role or company
--  * per-brand permission toggles are enforced by the database, not just UI

-- ------------------------------------------------------------------ invites

-- Kept on the profile so the team screen can show who is who without
-- reaching into auth.users.
alter table profiles add column email text;

create table company_invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  email text not null,
  role text not null default 'staff' check (role in ('admin', 'staff')),
  brand_ids uuid[] not null default '{}',
  brand_role text not null default 'operator' check (brand_role in ('admin', 'operator', 'viewer')),
  invited_by uuid references profiles(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index company_invites_email_key on company_invites (company_id, lower(email));

alter table company_invites enable row level security;

create policy invites_admin on company_invites for all
  using (company_id = current_company_id() and current_role_name() in ('owner', 'admin'))
  with check (company_id = current_company_id() and current_role_name() in ('owner', 'admin'));

-- First signup founds the company as owner. Everyone after that needs an
-- invite; without one they get an empty profile that can see nothing.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  existing_company uuid;
  new_company uuid;
  invite company_invites%rowtype;
begin
  select id into existing_company from companies order by created_at limit 1;

  if existing_company is null then
    insert into companies (name) values ('Zeebas Cluster LLP') returning id into new_company;
    insert into profiles (id, company_id, full_name, email, role)
      values (new.id, new_company, new.raw_user_meta_data ->> 'full_name', new.email, 'owner');
    return new;
  end if;

  select * into invite
  from company_invites
  where lower(email) = lower(new.email) and accepted_at is null
  order by created_at desc
  limit 1;

  if invite.id is null then
    insert into profiles (id, company_id, full_name, email, role)
      values (new.id, null, new.raw_user_meta_data ->> 'full_name', new.email, 'staff');
    return new;
  end if;

  insert into profiles (id, company_id, full_name, email, role)
    values (new.id, invite.company_id, new.raw_user_meta_data ->> 'full_name', new.email, invite.role);

  insert into brand_members (brand_id, user_id, role)
    select b, new.id, invite.brand_role
    from unnest(invite.brand_ids) as b
    where exists (select 1 from brands where id = b and company_id = invite.company_id);

  update company_invites set accepted_at = now() where id = invite.id;
  return new;
end $$;

-- ------------------------------------------------------- profile guardrails

create or replace function guard_profile_changes()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  actor text;
begin
  -- Service-role and trigger contexts (no signed-in user) are trusted.
  if auth.uid() is null then
    return new;
  end if;

  if new.company_id is distinct from old.company_id then
    raise exception 'Company membership cannot be changed from the app';
  end if;

  if new.role is distinct from old.role then
    actor := current_role_name();
    if actor not in ('owner', 'admin') then
      raise exception 'Only admins can change roles';
    end if;
    if old.role = 'owner' or new.role = 'owner' then
      raise exception 'The owner role cannot be assigned or removed';
    end if;
  end if;

  return new;
end $$;

create trigger profiles_guard
  before update on profiles
  for each row execute function guard_profile_changes();

-- Removing people goes through brand_members/role, never deleting profiles.
drop policy profile_admin on profiles;
create policy profile_admin_update on profiles for update
  using (company_id = current_company_id() and current_role_name() in ('owner', 'admin'))
  with check (company_id = current_company_id());

-- Staff only see the brands they belong to.
drop policy brand_read on brands;
create policy brand_read on brands for select using (has_brand_access(id));

-- ------------------------------------------------------ brand permissions

create or replace function brand_can(target_brand uuid, action text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when not has_brand_access(target_brand) then false
    when current_role_name() in ('owner', 'admin') then true
    else coalesce((
      select case action
        when 'write'   then m.role <> 'viewer'
        when 'edit'    then m.role = 'admin' or (m.role = 'operator' and m.can_edit_entries)
        when 'delete'  then m.role = 'admin' or (m.role = 'operator' and m.can_delete_entries)
        when 'see_all' then m.role = 'admin' or m.can_see_others_entries
        when 'reports' then m.role = 'admin' or m.can_view_reports
        when 'manage'  then m.role = 'admin'
        else false
      end
      from brand_members m
      where m.brand_id = target_brand and m.user_id = auth.uid()
    ), false)
  end;
$$;

/** Backdating rule, judged against the Indian calendar day rather than UTC. */
create or replace function backdate_allowed(target_brand uuid, entry_date date)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when brand_can(target_brand, 'manage') then true
    else coalesce((
      select case m.backdate_policy
        when 'always'  then true
        when 'never'   then entry_date >= (now() at time zone 'Asia/Kolkata')::date
        when 'one_day' then entry_date >= (now() at time zone 'Asia/Kolkata')::date - 1
      end
      from brand_members m
      where m.brand_id = target_brand and m.user_id = auth.uid()
    ), false)
  end;
$$;

-- Replace the blanket per-brand policies with read/write splits so viewers
-- are read-only everywhere.
do $$
declare t text;
begin
  foreach t in array array[
    'accounts', 'categories', 'payment_modes', 'parties', 'items', 'documents',
    'inbound_addresses', 'email_imports', 'counterparty_rules', 'activity_log'
  ] loop
    execute format('drop policy %1$s_rw on %1$s', t);
    execute format(
      'create policy %1$s_read on %1$s for select using (has_brand_access(brand_id))', t);
    execute format(
      'create policy %1$s_write on %1$s for insert with check (brand_can(brand_id, %2$L))', t, 'write');
    execute format(
      'create policy %1$s_update on %1$s for update using (brand_can(brand_id, %2$L)) with check (brand_can(brand_id, %2$L))',
      t, 'write');
    execute format(
      'create policy %1$s_delete on %1$s for delete using (brand_can(brand_id, %2$L))', t, 'manage');
  end loop;
end $$;

drop policy transactions_rw on transactions;

create policy transactions_read on transactions for select
  using (
    brand_can(brand_id, 'see_all')
    or (has_brand_access(brand_id) and created_by = auth.uid())
  );

create policy transactions_insert on transactions for insert
  with check (brand_can(brand_id, 'write') and backdate_allowed(brand_id, txn_date));

create policy transactions_update on transactions for update
  using (
    brand_can(brand_id, 'manage')
    or (brand_can(brand_id, 'edit') and created_by = auth.uid())
  )
  with check (
    (brand_can(brand_id, 'manage') or (brand_can(brand_id, 'edit') and created_by = auth.uid()))
    and backdate_allowed(brand_id, txn_date)
  );

create policy transactions_delete on transactions for delete
  using (
    brand_can(brand_id, 'manage')
    or (brand_can(brand_id, 'delete') and created_by = auth.uid())
  );

drop policy document_items_rw on document_items;
create policy document_items_read on document_items for select
  using (exists (select 1 from documents d where d.id = document_id and has_brand_access(d.brand_id)));
create policy document_items_write on document_items for all
  using (exists (select 1 from documents d where d.id = document_id and brand_can(d.brand_id, 'write')))
  with check (exists (select 1 from documents d where d.id = document_id and brand_can(d.brand_id, 'write')));

drop policy document_payments_rw on document_payments;
create policy document_payments_read on document_payments for select
  using (exists (select 1 from documents d where d.id = document_id and has_brand_access(d.brand_id)));
create policy document_payments_write on document_payments for all
  using (exists (select 1 from documents d where d.id = document_id and brand_can(d.brand_id, 'write')))
  with check (exists (select 1 from documents d where d.id = document_id and brand_can(d.brand_id, 'write')));

drop policy transfers_rw on transfers;
create policy transfers_read on transfers for select
  using (has_brand_access(from_brand_id) or has_brand_access(to_brand_id));
create policy transfers_write on transfers for insert
  with check (brand_can(from_brand_id, 'write') and brand_can(to_brand_id, 'write'));
-- createTransfer back-fills the two transaction ids right after inserting,
-- so anyone allowed to create a transfer must be able to finish it.
create policy transfers_update on transfers for update
  using (brand_can(from_brand_id, 'write') and brand_can(to_brand_id, 'write'))
  with check (brand_can(from_brand_id, 'write') and brand_can(to_brand_id, 'write'));
create policy transfers_delete on transfers for delete
  using (brand_can(from_brand_id, 'manage') and brand_can(to_brand_id, 'manage'));

-- Receipt uploads follow the same read/write split.
drop policy receipts_insert on storage.objects;
drop policy receipts_delete on storage.objects;
create policy receipts_insert on storage.objects for insert
  with check (bucket_id = 'receipts' and brand_can(receipt_brand(name), 'write'));
create policy receipts_delete on storage.objects for delete
  using (bucket_id = 'receipts' and brand_can(receipt_brand(name), 'write'));

-- Everything the UI needs to show or hide per brand, in one round trip.
create or replace function my_brand_permissions()
returns table (
  brand_id uuid,
  can_write boolean,
  can_edit boolean,
  can_delete boolean,
  can_manage boolean,
  can_reports boolean,
  can_see_all boolean
)
language sql stable security definer set search_path = public as $$
  select
    b.id,
    brand_can(b.id, 'write'),
    brand_can(b.id, 'edit'),
    brand_can(b.id, 'delete'),
    brand_can(b.id, 'manage'),
    brand_can(b.id, 'reports'),
    brand_can(b.id, 'see_all')
  from brands b
  where has_brand_access(b.id);
$$;
