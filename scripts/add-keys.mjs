import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const keys = [
  {
    product_slug: "r6-frost-day",
    key_value: "Yo53D3v73nWGst7rTqgReGe15XqXEc4CAaGddclhzi5ef356ec",
    status: "unused",
  },
  {
    product_slug: "linked-nfa-account",
    key_value: "Prelinked112@outlook.com:Edits2x3",
    status: "unused",
  },
];

const { data, error } = await supabase
  .from("license_keys")
  .insert(keys)
  .select("id, product_slug, key_value, status, created_at");

if (error) {
  console.error("Failed:", error.message);
  process.exit(1);
}

console.log("Inserted", data.length, "keys:");
for (const row of data) {
  console.log(`  ${row.product_slug} → ${row.key_value} (${row.status})`);
}
