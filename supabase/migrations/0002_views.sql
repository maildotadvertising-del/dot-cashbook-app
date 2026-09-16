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
