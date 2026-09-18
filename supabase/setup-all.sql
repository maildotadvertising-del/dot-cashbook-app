-- DOT Cash Book — all migrations combined for one-time paste into the Supabase SQL Editor.
-- Generated from supabase/migrations/*.sql; run once on a fresh project.

-- ==================================================== supabase/migrations/0001_init.sql
-- DOT Cash Book — initial schema
-- Company (Zeebas Cluster LLP) -> Brands -> per-brand ledgers.

-- ---------------------------------------------------------------- core org

create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table brands (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  legal_name text,
  gstin text,
  address text,
  phone text,
  email text,
  logo_url text,
  state_code text,
  invoice_prefix text not null default 'INV',
  quotation_prefix text not null default 'QTN',
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index on brands (company_id);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid references companies(id) on delete set null,
  full_name text,
  phone text,
  avatar_url text,
  -- owner: the single primary admin. admin: full access to every brand.
  -- staff: only the brands listed in brand_members.
  role text not null default 'staff' check (role in ('owner', 'admin', 'staff')),
  created_at timestamptz not null default now()
);

create table brand_members (
  brand_id uuid not null references brands(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'operator' check (role in ('admin', 'operator', 'viewer')),
  can_edit_entries boolean not null default true,
  can_delete_entries boolean not null default false,
  can_view_reports boolean not null default true,
  can_see_others_entries boolean not null default true,
  backdate_policy text not null default 'always'
    check (backdate_policy in ('always', 'never', 'one_day')),
  created_at timestamptz not null default now(),
  primary key (brand_id, user_id)
);
create index on brand_members (user_id);

-- ------------------------------------------------------------- ledger setup

create table accounts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  name text not null,
  type text not null default 'cash' check (type in ('cash', 'bank', 'petty', 'wallet')),
  bank_name text,
  account_last4 text,
  opening_balance numeric(14, 2) not null default 0,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index on accounts (brand_id);

create table categories (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  name text not null,
  kind text not null default 'both' check (kind in ('income', 'expense', 'both')),
  created_at timestamptz not null default now(),
  unique (brand_id, name)
);

create table payment_modes (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (brand_id, name)
);

create table parties (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  name text not null,
  type text not null default 'customer' check (type in ('customer', 'supplier', 'both')),
  phone text,
  email text,
  gstin text,
  address text,
  state_code text,
  -- positive = party owes the brand, negative = brand owes the party
  opening_balance numeric(14, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);
create index on parties (brand_id);

-- ------------------------------------------------------------- transactions

create table transactions (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete restrict,
  direction text not null check (direction in ('in', 'out')),
  amount numeric(14, 2) not null check (amount > 0),
  txn_date date not null default current_date,
  txn_at timestamptz not null default now(),
  remark text,
  party_id uuid references parties(id) on delete set null,
  category_id uuid references categories(id) on delete set null,
  payment_mode_id uuid references payment_modes(id) on delete set null,
  bill_url text,
  source text not null default 'manual'
    check (source in ('manual', 'email', 'statement', 'transfer', 'document')),
  -- bank/UPI reference used to guarantee an imported transaction lands once
  bank_ref text,
  counterparty text,
  needs_review boolean not null default false,
  transfer_id uuid,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on transactions (brand_id, txn_date desc);
create index on transactions (account_id);
create index on transactions (party_id);
create unique index transactions_bank_ref_key
  on transactions (brand_id, bank_ref) where bank_ref is not null;

-- Inter-brand fund transfer: one action, two linked ledger entries.
create table transfers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  from_brand_id uuid not null references brands(id) on delete cascade,
  to_brand_id uuid not null references brands(id) on delete cascade,
  from_transaction_id uuid references transactions(id) on delete cascade,
  to_transaction_id uuid references transactions(id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  transfer_date date not null default current_date,
  note text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (from_brand_id <> to_brand_id)
);

alter table transactions
  add constraint transactions_transfer_fk
  foreign key (transfer_id) references transfers(id) on delete set null;

-- --------------------------------------------------- items & sales documents

create table items (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  name text not null,
  kind text not null default 'service' check (kind in ('product', 'service')),
  description text,
  hsn_sac text,
  unit text not null default 'nos',
  rate numeric(14, 2) not null default 0,
  gst_rate numeric(5, 2) not null default 18,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on items (brand_id);

create table documents (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  doc_type text not null check (doc_type in ('quotation', 'invoice', 'purchase_bill')),
  doc_number text not null,
  party_id uuid references parties(id) on delete set null,
  doc_date date not null default current_date,
  due_date date,
  -- GST invoice or plain non-GST invoice
  is_gst boolean not null default true,
  -- intra = CGST + SGST, inter = IGST
  gst_treatment text not null default 'intra' check (gst_treatment in ('intra', 'inter')),
  place_of_supply text,
  subtotal numeric(14, 2) not null default 0,
  discount numeric(14, 2) not null default 0,
  cgst numeric(14, 2) not null default 0,
  sgst numeric(14, 2) not null default 0,
  igst numeric(14, 2) not null default 0,
  round_off numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  amount_paid numeric(14, 2) not null default 0,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'accepted', 'rejected', 'partial', 'paid', 'cancelled')),
  notes text,
  terms text,
  converted_from uuid references documents(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, doc_type, doc_number)
);
create index on documents (brand_id, doc_type, doc_date desc);
create index on documents (party_id);

create table document_items (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  item_id uuid references items(id) on delete set null,
  name text not null,
  description text,
  hsn_sac text,
  qty numeric(12, 3) not null default 1,
  unit text,
  rate numeric(14, 2) not null default 0,
  discount_pct numeric(5, 2) not null default 0,
  gst_rate numeric(5, 2) not null default 0,
  amount numeric(14, 2) not null default 0,
  sort_order int not null default 0
);
create index on document_items (document_id);

create table document_payments (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  transaction_id uuid references transactions(id) on delete set null,
  amount numeric(14, 2) not null check (amount > 0),
  paid_on date not null default current_date,
  created_at timestamptz not null default now()
);
create index on document_payments (document_id);

-- ------------------------------------------------- email auto-capture (UPI)

create table inbound_addresses (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  address text not null unique,
  default_account_id uuid references accounts(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table email_imports (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade,
  to_address text,
  from_address text,
  subject text,
  raw_body text,
  parsed jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'imported', 'failed', 'duplicate', 'ignored')),
  transaction_id uuid references transactions(id) on delete set null,
  error text,
  received_at timestamptz not null default now()
);
create index on email_imports (brand_id, received_at desc);

-- Remembers how a counterparty/VPA was categorised, to auto-fill next time.
create table counterparty_rules (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  match_key text not null,
  party_id uuid references parties(id) on delete set null,
  category_id uuid references categories(id) on delete set null,
  payment_mode_id uuid references payment_modes(id) on delete set null,
  hit_count int not null default 1,
  updated_at timestamptz not null default now(),
  unique (brand_id, match_key)
);

create table activity_log (
  id bigserial primary key,
  brand_id uuid references brands(id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  actor_id uuid references profiles(id) on delete set null,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index on activity_log (brand_id, created_at desc);

-- ------------------------------------------------------------ access helpers

-- security definer so policies can read profiles without recursing into RLS
create or replace function current_company_id()
returns uuid language sql stable security definer set search_path = public as $$
  select company_id from profiles where id = auth.uid();
$$;

create or replace function current_role_name()
returns text language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function has_brand_access(target_brand uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from brands b
    where b.id = target_brand
      and b.company_id = current_company_id()
      and (
        current_role_name() in ('owner', 'admin')
        or exists (
          select 1 from brand_members m
          where m.brand_id = b.id and m.user_id = auth.uid()
        )
      )
  );
$$;

-- ---------------------------------------------------------------------- RLS

alter table companies enable row level security;
alter table brands enable row level security;
alter table profiles enable row level security;
alter table brand_members enable row level security;
alter table accounts enable row level security;
alter table categories enable row level security;
alter table payment_modes enable row level security;
alter table parties enable row level security;
alter table transactions enable row level security;
alter table transfers enable row level security;
alter table items enable row level security;
alter table documents enable row level security;
alter table document_items enable row level security;
alter table document_payments enable row level security;
alter table inbound_addresses enable row level security;
alter table email_imports enable row level security;
alter table counterparty_rules enable row level security;
alter table activity_log enable row level security;

create policy company_read on companies for select
  using (id = current_company_id());
create policy company_write on companies for all
  using (id = current_company_id() and current_role_name() in ('owner', 'admin'))
  with check (id = current_company_id() and current_role_name() in ('owner', 'admin'));

create policy brand_read on brands for select
  using (company_id = current_company_id());
create policy brand_write on brands for all
  using (company_id = current_company_id() and current_role_name() in ('owner', 'admin'))
  with check (company_id = current_company_id() and current_role_name() in ('owner', 'admin'));

create policy profile_self on profiles for select
  using (id = auth.uid() or company_id = current_company_id());
create policy profile_update_self on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
create policy profile_admin on profiles for all
  using (company_id = current_company_id() and current_role_name() in ('owner', 'admin'))
  with check (company_id = current_company_id() and current_role_name() in ('owner', 'admin'));

create policy member_read on brand_members for select
  using (user_id = auth.uid() or has_brand_access(brand_id));
create policy member_write on brand_members for all
  using (current_role_name() in ('owner', 'admin') and has_brand_access(brand_id))
  with check (current_role_name() in ('owner', 'admin') and has_brand_access(brand_id));

-- Per-brand tables all share the same shape: access follows brand access.
do $$
declare t text;
begin
  foreach t in array array[
    'accounts', 'categories', 'payment_modes', 'parties', 'transactions',
    'items', 'documents', 'inbound_addresses', 'email_imports',
    'counterparty_rules', 'activity_log'
  ] loop
    execute format(
      'create policy %1$s_rw on %1$s for all using (has_brand_access(brand_id)) with check (has_brand_access(brand_id))',
      t
    );
  end loop;
end $$;

create policy transfers_rw on transfers for all
  using (has_brand_access(from_brand_id) or has_brand_access(to_brand_id))
  with check (has_brand_access(from_brand_id) and has_brand_access(to_brand_id));

create policy document_items_rw on document_items for all
  using (exists (select 1 from documents d where d.id = document_id and has_brand_access(d.brand_id)))
  with check (exists (select 1 from documents d where d.id = document_id and has_brand_access(d.brand_id)));

create policy document_payments_rw on document_payments for all
  using (exists (select 1 from documents d where d.id = document_id and has_brand_access(d.brand_id)))
  with check (exists (select 1 from documents d where d.id = document_id and has_brand_access(d.brand_id)));

-- --------------------------------------------------------------- new signup

-- First user to sign up creates the company and becomes its owner; later
-- signups join that company as staff.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  existing_company uuid;
  new_company uuid;
begin
  select id into existing_company from companies order by created_at limit 1;

  if existing_company is null then
    insert into companies (name) values ('Zeebas Cluster LLP') returning id into new_company;
    insert into profiles (id, company_id, full_name, role)
      values (new.id, new_company, new.raw_user_meta_data ->> 'full_name', 'owner');
  else
    insert into profiles (id, company_id, full_name, role)
      values (new.id, existing_company, new.raw_user_meta_data ->> 'full_name', 'staff');
  end if;

  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ==================================================== supabase/migrations/0002_views.sql
-- Balances and summaries. Kept in SQL so every screen agrees on the numbers.

create or replace view account_balances
with (security_invoker = true) as
select
  a.id as account_id,
  a.brand_id,
  a.name,
  a.type,
  a.opening_balance
    + coalesce(sum(t.amount) filter (where t.direction = 'in'), 0)
    - coalesce(sum(t.amount) filter (where t.direction = 'out'), 0) as balance
from accounts a
left join transactions t on t.account_id = a.id
where a.is_active
group by a.id, a.brand_id, a.name, a.type, a.opening_balance;

create or replace view brand_balances
with (security_invoker = true) as
select
  b.id as brand_id,
  b.name,
  coalesce(sum(ab.balance), 0) as balance,
  coalesce(sum(ab.balance) filter (where ab.type = 'cash'), 0) as cash_balance,
  coalesce(sum(ab.balance) filter (where ab.type = 'bank'), 0) as bank_balance
from brands b
left join account_balances ab on ab.brand_id = b.id
group by b.id, b.name;

/** Money a party owes the brand (positive) or the brand owes them (negative). */
create or replace view party_balances
with (security_invoker = true) as
select
  p.id as party_id,
  p.brand_id,
  p.name,
  p.type,
  p.opening_balance
    + coalesce(sum(d.total - d.amount_paid) filter (where d.doc_type = 'invoice'
        and d.status not in ('draft', 'cancelled')), 0)
    - coalesce(sum(d.total - d.amount_paid) filter (where d.doc_type = 'purchase_bill'
        and d.status not in ('draft', 'cancelled')), 0) as balance
from parties p
left join documents d on d.party_id = p.id
group by p.id, p.brand_id, p.name, p.type, p.opening_balance;

create or replace function ledger_summary(
  target_brand uuid,
  from_date date default null,
  to_date date default null,
  account uuid default null
)
returns table (total_in numeric, total_out numeric, net numeric)
language sql stable security invoker as $$
  select
    coalesce(sum(amount) filter (where direction = 'in'), 0),
    coalesce(sum(amount) filter (where direction = 'out'), 0),
    coalesce(sum(amount) filter (where direction = 'in'), 0)
      - coalesce(sum(amount) filter (where direction = 'out'), 0)
  from transactions
  where brand_id = target_brand
    and (from_date is null or txn_date >= from_date)
    and (to_date is null or txn_date <= to_date)
    and (account is null or account_id = account);
$$;

/** Daily in/out totals, used by the dashboard chart. */
create or replace function daily_totals(
  target_brand uuid,
  from_date date,
  to_date date
)
returns table (day date, total_in numeric, total_out numeric)
language sql stable security invoker as $$
  select
    txn_date,
    coalesce(sum(amount) filter (where direction = 'in'), 0),
    coalesce(sum(amount) filter (where direction = 'out'), 0)
  from transactions
  where brand_id = target_brand
    and txn_date between from_date and to_date
  group by txn_date
  order by txn_date;
$$;

/** Category totals for a period, used by reports. */
create or replace function category_totals(
  target_brand uuid,
  from_date date,
  to_date date
)
returns table (category_id uuid, category_name text, direction text, total numeric)
language sql stable security invoker as $$
  select
    t.category_id,
    coalesce(c.name, 'Uncategorised'),
    t.direction,
    sum(t.amount)
  from transactions t
  left join categories c on c.id = t.category_id
  where t.brand_id = target_brand
    and t.txn_date between from_date and to_date
  group by t.category_id, c.name, t.direction
  order by sum(t.amount) desc;
$$;

-- ==================================================== supabase/migrations/0003_documents.sql
-- Invoice/quotation numbering and totals upkeep.

/**
 * Next document number for a brand, as PREFIX-0001. Numbering is per brand
 * and per document type, so invoices and quotations count separately.
 */
create or replace function next_doc_number(target_brand uuid, target_type text)
returns text language plpgsql stable security invoker as $$
declare
  prefix text;
  last_seq int;
begin
  select case target_type
           when 'quotation' then quotation_prefix
           when 'purchase_bill' then 'BILL'
           else invoice_prefix
         end
    into prefix
  from brands where id = target_brand;

  select coalesce(max(nullif(regexp_replace(doc_number, '\D', '', 'g'), '')::int), 0)
    into last_seq
  from documents
  where brand_id = target_brand and doc_type = target_type;

  return prefix || '-' || lpad((last_seq + 1)::text, 4, '0');
end $$;

/** Keeps documents.amount_paid and status in step with its payments. */
create or replace function sync_document_payment()
returns trigger language plpgsql security invoker as $$
declare
  target uuid := coalesce(new.document_id, old.document_id);
  paid numeric;
  doc documents%rowtype;
begin
  select coalesce(sum(amount), 0) into paid
  from document_payments where document_id = target;

  select * into doc from documents where id = target;

  update documents
  set amount_paid = paid,
      status = case
        when doc.status in ('draft', 'cancelled') then doc.status
        when paid <= 0 then 'sent'
        when paid >= doc.total then 'paid'
        else 'partial'
      end,
      updated_at = now()
  where id = target;

  return null;
end $$;

create trigger document_payments_sync
  after insert or update or delete on document_payments
  for each row execute function sync_document_payment();

-- ==================================================== supabase/migrations/0004_receipts.sql
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

-- ==================================================== supabase/migrations/0005_access_control.sql
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

-- ==================================================== supabase/migrations/0006_items_pricing_and_workspace_settings.sql
-- Items carry both what they cost us and what we sell them for; each
-- workspace (Items / Sales / Accounts) keeps its own defaults on the brand.

alter table items add column purchase_rate numeric(14, 2) not null default 0;
comment on column items.rate is 'Sale rate — used on quotations and invoices';
comment on column items.purchase_rate is 'Purchase rate — used on purchase bills';

alter table brands
  add column item_default_gst numeric(5, 2) not null default 18,
  add column item_default_unit text not null default 'nos',
  add column default_terms text,
  add column default_notes text;

-- ==================================================== supabase/migrations/0007_labels_rules_recurring_transfers.sql
-- Wallet-style features: labels, keyword auto-categorisation rules,
-- recurring entries, and transfers between accounts of the same brand.

-- ------------------------------------------------------------------ labels

create table labels (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  name text not null,
  color text not null default '#0A84FF',
  created_at timestamptz not null default now(),
  unique (brand_id, name)
);

-- Labels live on the entry as an id array: one filterable column, no join
-- table, and the entry's own RLS already covers who can see them.
alter table transactions add column label_ids uuid[] not null default '{}';
create index transactions_label_ids_idx on transactions using gin (label_ids);

-- Deleting a label strips it from every entry that carried it.
create or replace function strip_deleted_label()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update transactions set label_ids = array_remove(label_ids, old.id)
  where brand_id = old.brand_id and old.id = any(label_ids);
  update category_rules set label_ids = array_remove(label_ids, old.id)
  where brand_id = old.brand_id and old.id = any(label_ids);
  update recurring_entries set label_ids = array_remove(label_ids, old.id)
  where brand_id = old.brand_id and old.id = any(label_ids);
  return old;
end $$;

-- ------------------------------------------------------ auto category rules

create table category_rules (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  name text not null,
  keywords text[] not null check (cardinality(keywords) > 0),
  -- null = applies to money in and out
  direction text check (direction in ('in', 'out')),
  category_id uuid references categories(id) on delete set null,
  party_id uuid references parties(id) on delete set null,
  payment_mode_id uuid references payment_modes(id) on delete set null,
  label_ids uuid[] not null default '{}',
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on category_rules (brand_id, sort_order);

-- --------------------------------------------------------- recurring entries

create table recurring_entries (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  name text not null,
  direction text not null check (direction in ('in', 'out')),
  amount numeric(14, 2) not null check (amount > 0),
  account_id uuid not null references accounts(id) on delete cascade,
  category_id uuid references categories(id) on delete set null,
  party_id uuid references parties(id) on delete set null,
  payment_mode_id uuid references payment_modes(id) on delete set null,
  label_ids uuid[] not null default '{}',
  remark text,
  frequency text not null default 'monthly'
    check (frequency in ('weekly', 'monthly', 'quarterly', 'yearly')),
  next_due date not null,
  is_active boolean not null default true,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on recurring_entries (brand_id, next_due);

create trigger labels_strip_on_delete
  after delete on labels
  for each row execute function strip_deleted_label();

-- ------------------------------------------- transfers between own accounts

-- A transfer may now stay inside one brand (Cash -> Bank), as long as the
-- two accounts differ; cross-brand transfers keep working as before.
alter table transfers drop constraint if exists transfers_check;
alter table transfers
  add column from_account_id uuid references accounts(id) on delete set null,
  add column to_account_id uuid references accounts(id) on delete set null,
  add constraint transfers_distinct_ends check (
    from_brand_id <> to_brand_id
    or from_account_id is null
    or to_account_id is null
    or from_account_id <> to_account_id
  );

-- ----------------------------------------------------------------------- RLS

alter table labels enable row level security;
alter table category_rules enable row level security;
alter table recurring_entries enable row level security;

do $$
declare t text;
begin
  foreach t in array array['labels', 'category_rules', 'recurring_entries'] loop
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

-- ------------------------------------------------------- reporting helpers

/**
 * Income/expense for P&L-style views. Transfers only move money between the
 * company's own accounts, so they are neither — unlike the cash book totals
 * (ledger_summary), which rightly show every rupee in and out of a book.
 */
create or replace function pl_summary(
  target_brand uuid,
  from_date date default null,
  to_date date default null
)
returns table (total_in numeric, total_out numeric, net numeric)
language sql stable security invoker as $$
  select
    coalesce(sum(amount) filter (where direction = 'in'), 0),
    coalesce(sum(amount) filter (where direction = 'out'), 0),
    coalesce(sum(amount) filter (where direction = 'in'), 0)
      - coalesce(sum(amount) filter (where direction = 'out'), 0)
  from transactions
  where brand_id = target_brand
    and source <> 'transfer'
    and (from_date is null or txn_date >= from_date)
    and (to_date is null or txn_date <= to_date);
$$;

create or replace function category_totals(
  target_brand uuid,
  from_date date,
  to_date date
)
returns table (category_id uuid, category_name text, direction text, total numeric)
language sql stable security invoker as $$
  select
    t.category_id,
    coalesce(c.name, 'Uncategorised'),
    t.direction,
    sum(t.amount)
  from transactions t
  left join categories c on c.id = t.category_id
  where t.brand_id = target_brand
    and t.source <> 'transfer'
    and t.txn_date between from_date and to_date
  group by t.category_id, c.name, t.direction
  order by sum(t.amount) desc;
$$;

create or replace function label_totals(
  target_brand uuid,
  from_date date,
  to_date date
)
returns table (label_id uuid, label_name text, color text, direction text, total numeric)
language sql stable security invoker as $$
  select l.id, l.name, l.color, t.direction, sum(t.amount)
  from transactions t
  cross join lateral unnest(t.label_ids) as tl(id)
  join labels l on l.id = tl.id
  where t.brand_id = target_brand
    and t.source <> 'transfer'
    and t.txn_date between from_date and to_date
  group by l.id, l.name, l.color, t.direction
  order by sum(t.amount) desc;
$$;

/** Who the money went to / came from: party name, else bank counterparty. */
create or replace function payee_totals(
  target_brand uuid,
  from_date date,
  to_date date,
  max_rows int default 10
)
returns table (payee text, direction text, total numeric, entries bigint)
language sql stable security invoker as $$
  select
    coalesce(p.name, nullif(trim(t.counterparty), ''), 'Unknown'),
    t.direction,
    sum(t.amount),
    count(*)
  from transactions t
  left join parties p on p.id = t.party_id
  where t.brand_id = target_brand
    and t.source <> 'transfer'
    and t.txn_date between from_date and to_date
  group by 1, 2
  order by sum(t.amount) desc
  limit max_rows * 2;
$$;

create or replace function monthly_totals(target_brand uuid, months int default 6)
returns table (month date, total_in numeric, total_out numeric)
language sql stable security invoker as $$
  with bounds as (
    select date_trunc('month', (now() at time zone 'Asia/Kolkata'))::date as this_month
  ),
  series as (
    select generate_series(
      (select this_month from bounds) - make_interval(months => months - 1),
      (select this_month from bounds),
      interval '1 month'
    )::date as month
  )
  select
    s.month,
    coalesce(sum(t.amount) filter (where t.direction = 'in'), 0),
    coalesce(sum(t.amount) filter (where t.direction = 'out'), 0)
  from series s
  left join transactions t
    on t.brand_id = target_brand
    and t.source <> 'transfer'
    and date_trunc('month', t.txn_date)::date = s.month
  group by s.month
  order by s.month;
$$;
