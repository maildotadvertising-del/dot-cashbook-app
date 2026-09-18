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
