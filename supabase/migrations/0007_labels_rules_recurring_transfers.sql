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
