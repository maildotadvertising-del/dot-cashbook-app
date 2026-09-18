import { matchRule } from "../src/lib/rules.ts";
import type { CategoryRule } from "../src/lib/types.ts";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`      ${JSON.stringify(detail)}`);
}

const rule = (over: Partial<CategoryRule>): CategoryRule => ({
  id: over.name ?? "r",
  brand_id: "b",
  name: "r",
  keywords: [],
  direction: null,
  category_id: null,
  party_id: null,
  payment_mode_id: null,
  label_ids: [],
  sort_order: 0,
  is_active: true,
  ...over,
});

const rules = [
  rule({ name: "Team Fuel", keywords: ["Team Fuel"], sort_order: 0 }),
  rule({ name: "Fuel", keywords: ["Petrol", "Diesel", "Fuel"], sort_order: 1 }),
  rule({ name: "Tea", keywords: ["Tea", "Juice", "Snacks"], sort_order: 2 }),
  rule({ name: "Salary in", keywords: ["salary"], direction: "in", sort_order: 3 }),
  rule({ name: "Off", keywords: ["milk"], is_active: false, sort_order: 4 }),
];

const name = (text: string, dir?: "in" | "out") => matchRule(rules, text, dir)?.rule.name ?? null;

check("UPI narration keyword", name("UPI-GVS COFFEE BAR-GVSCOFFEEBAR23@FBL-FDRL-336-TEA Ref Num: 7336") === "Tea");
check("case-insensitive", name("hp petrol bunk") === "Fuel");
check("whole word only: TEAM is not TEA", name("TEAM ALLOWANCE") === null, name("TEAM ALLOWANCE"));
check("earlier rule wins", name("Team Fuel for shoot") === "Team Fuel");
check("direction filter blocks", name("SABEEZ SALARY PART", "out") === null);
check("direction filter allows", name("SABEEZ SALARY PART", "in") === "Salary in");
check("inactive rules ignored", name("milk") === null);
check("empty text", name("   ") === null);

console.log(failures ? `\n${failures} failing` : "\nall passing");
if (failures) process.exit(1);
