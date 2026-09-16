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
