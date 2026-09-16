-- DOT Cash Book — initial schema
-- Company (Zeebas Cluster LLP) -> Brands -> per-brand ledgers.

create extension if not exists "pgcrypto";

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
