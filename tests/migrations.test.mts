/**
 * Runs every migration against an in-process Postgres (PGlite) with small
 * stand-ins for Supabase's auth and storage schemas, then checks the access
 * rules behave as intended. Catches SQL mistakes without a Supabase project.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
let failures = 0;

function check(name: string, ok: boolean, detail?: unknown) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok && detail !== undefined) console.log(`      ${String(detail)}`);
}

async function expectError(name: string, run: () => Promise<unknown>, match?: RegExp) {
  try {
    await run();
    check(name, false, "expected an error, got none");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    check(name, !match || match.test(message), message);
  }
}

await db.exec(`
  create schema auth;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb default '{}'
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;

  create schema storage;
  create table storage.buckets (
    id text primary key, name text, public boolean,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text, name text
  );
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;

  create role app_user nologin;
`);

const dir = process.env.MIGRATIONS_DIR ?? join(import.meta.dirname, "..", "supabase", "migrations");
for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  try {
    await db.exec(readFileSync(join(dir, file), "utf8"));
    check(`migration ${file} applies`, true);
  } catch (err) {
    check(`migration ${file} applies`, false, err instanceof Error ? err.message : err);
  }
}

await db.exec(`
  grant usage on schema public, auth, storage to app_user;
  grant all on all tables in schema public to app_user;
  grant all on all sequences in schema public to app_user;
  grant all on all tables in schema storage to app_user;
  grant execute on all functions in schema public, auth, storage to app_user;
`);

const OWNER = "00000000-0000-0000-0000-000000000001";
const STAFF = "00000000-0000-0000-0000-000000000002";
const STRANGER = "00000000-0000-0000-0000-000000000003";

async function asSystem<T>(sql: string, params: unknown[] = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  return (await db.query<T>(sql, params)).rows;
}

async function as<T>(user: string, sql: string, params: unknown[] = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user}', false); set role app_user;`);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec(`reset role;`);
  }
}

if (failures === 0) {
  // --- signup ---------------------------------------------------------------
  await asSystem(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'owner@z.in', '{"full_name":"Owner"}')`, [OWNER]);
  const [owner] = await asSystem<{ role: string; company_id: string }>(`select role, company_id from profiles where id = $1`, [OWNER]);
  check("first signup becomes owner with a company", owner?.role === "owner" && !!owner.company_id);

  await asSystem(`insert into auth.users (id, email) values ($1, 'random@x.com')`, [STRANGER]);
  const [stranger] = await asSystem<{ company_id: string | null }>(`select company_id from profiles where id = $1`, [STRANGER]);
  check("uninvited signup gets no company", stranger?.company_id === null);

  // --- owner sets up brands --------------------------------------------------
  const [brandA] = await as<{ id: string }>(OWNER, `insert into brands (company_id, name, gstin) values ($1, 'DOT Advertising', '33ABCDE1234F1Z5') returning id`, [owner.company_id]);
  const [brandB] = await as<{ id: string }>(OWNER, `insert into brands (company_id, name) values ($1, 'Brand Two') returning id`, [owner.company_id]);
  const [cashA] = await as<{ id: string }>(OWNER, `insert into accounts (brand_id, name) values ($1, 'Cash') returning id`, [brandA.id]);
  await as(OWNER, `insert into accounts (brand_id, name) values ($1, 'Cash')`, [brandB.id]);

  await as(OWNER, `insert into transactions (brand_id, account_id, direction, amount, txn_date) values ($1, $2, 'in', 1000, current_date - 30)`, [brandA.id, cashA.id]);
  const [summary] = await as<{ total_in: string; net: string }>(OWNER, `select * from ledger_summary($1)`, [brandA.id]);
  check("owner can post and ledger_summary adds up", Number(summary?.total_in) === 1000);

  const strangerBrands = await as(STRANGER, `select id from brands`);
  check("stranger sees no brands", strangerBrands.length === 0);

  // --- invite staff to brand A only ------------------------------------------
  await as(OWNER, `insert into company_invites (company_id, email, role, brand_ids, brand_role) values ($1, 'Staff@Z.in', 'staff', $2, 'operator')`, [owner.company_id, [brandA.id]]);
  await asSystem(`insert into auth.users (id, email) values ($1, 'staff@z.in')`, [STAFF]);
  const [staff] = await asSystem<{ company_id: string; role: string }>(`select company_id, role from profiles where id = $1`, [STAFF]);
  check("invited signup joins the company (email case-insensitive)", staff?.company_id === owner.company_id && staff.role === "staff");

  const staffBrands = await as<{ id: string }>(STAFF, `select id from brands`);
  check("staff sees only their brand", staffBrands.length === 1 && staffBrands[0].id === brandA.id);

  const ownerEntriesSeen = await as(STAFF, `select id from transactions where brand_id = $1`, [brandA.id]);
  check("operator sees others' entries by default", ownerEntriesSeen.length === 1);

  await as(STAFF, `insert into transactions (brand_id, account_id, direction, amount, txn_date, created_by) values ($1, $2, 'out', 50, current_date, $3)`, [brandA.id, cashA.id, STAFF]);
  check("operator can add today's entry", true);

  await expectError("staff cannot promote themselves", () =>
    as(STAFF, `update profiles set role = 'admin' where id = $1`, [STAFF]), /only admins/i);

  await expectError("admin cannot hand out owner role", () =>
    as(OWNER, `update profiles set role = 'owner' where id = $1`, [STAFF]), /owner role/i);

  // --- permission toggles ----------------------------------------------------
  await as(OWNER, `update brand_members set backdate_policy = 'never', can_see_others_entries = false where user_id = $1`, [STAFF]);

  await expectError("backdate 'never' blocks yesterday's entry", () =>
    as(STAFF, `insert into transactions (brand_id, account_id, direction, amount, txn_date, created_by) values ($1, $2, 'out', 10, current_date - 3, $3)`, [brandA.id, cashA.id, STAFF]),
    /row-level security/i);

  const onlyOwn = await as<{ amount: string }>(STAFF, `select amount from transactions where brand_id = $1`, [brandA.id]);
  check("hiding others' entries leaves only their own", onlyOwn.length === 1 && Number(onlyOwn[0].amount) === 50);

  const deleted = await as(STAFF, `delete from transactions where brand_id = $1 returning id`, [brandA.id]);
  check("operator without delete permission deletes nothing", deleted.length === 0);

  await as(OWNER, `update brand_members set role = 'viewer' where user_id = $1`, [STAFF]);
  await expectError("viewer cannot add parties", () =>
    as(STAFF, `insert into parties (brand_id, name) values ($1, 'X')`, [brandA.id]), /row-level security/i);

  const perms = await as<{ brand_id: string; can_write: boolean; can_reports: boolean }>(STAFF, `select * from my_brand_permissions()`);
  check(
    "my_brand_permissions reports viewer as read-only on their one brand",
    perms.length === 1 && perms[0].brand_id === brandA.id && perms[0].can_write === false,
    JSON.stringify(perms),
  );
  const [ownerProfile] = await asSystem<{ email: string }>(`select email from profiles where id = $1`, [OWNER]);
  check("profile keeps the signup email", ownerProfile?.email === "owner@z.in");

  const blocked = await as(STAFF, `select id from accounts where brand_id = $1`, [brandB.id]);
  check("staff cannot read another brand's accounts", blocked.length === 0);

  // --- documents -------------------------------------------------------------
  const [num] = await as<{ n: string }>(OWNER, `select next_doc_number($1, 'invoice') as n`, [brandA.id]);
  check("first invoice number is INV-0001", num?.n === "INV-0001");

  const [doc] = await as<{ id: string }>(OWNER, `insert into documents (brand_id, doc_type, doc_number, total, status) values ($1, 'invoice', 'INV-0001', 1180, 'sent') returning id`, [brandA.id]);
  await as(OWNER, `insert into document_payments (document_id, amount) values ($1, 500)`, [doc.id]);
  const [partial] = await as<{ status: string; amount_paid: string }>(OWNER, `select status, amount_paid from documents where id = $1`, [doc.id]);
  check("partial payment marks invoice partial", partial?.status === "partial" && Number(partial.amount_paid) === 500);

  await as(OWNER, `insert into document_payments (document_id, amount) values ($1, 680)`, [doc.id]);
  const [paid] = await as<{ status: string }>(OWNER, `select status from documents where id = $1`, [doc.id]);
  check("full payment marks invoice paid", paid?.status === "paid");

  const [next] = await as<{ n: string }>(OWNER, `select next_doc_number($1, 'invoice') as n`, [brandA.id]);
  check("numbering continues to INV-0002", next?.n === "INV-0002");

  const [bal] = await as<{ balance: string }>(OWNER, `select balance from account_balances where account_id = $1`, [cashA.id]);
  check("account balance reflects both entries", Number(bal?.balance) === 950);

  // --- receipts storage ------------------------------------------------------
  await as(OWNER, `update brand_members set role = 'operator' where user_id = $1`, [STAFF]);
  await as(STAFF, `insert into storage.objects (bucket_id, name) values ('receipts', $1)`, [`${brandA.id}/a.jpg`]);
  check("member can upload a receipt to their brand", true);
  await expectError("member cannot upload into another brand's folder", () =>
    as(STAFF, `insert into storage.objects (bucket_id, name) values ('receipts', $1)`, [`${brandB.id}/b.jpg`]),
    /row-level security/i);
}

console.log(failures ? `\n${failures} failing` : "\nall passing");
process.exit(failures ? 1 : 0);
