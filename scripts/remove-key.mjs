import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const keyToRemove = "[REMOVED-KEY]";

const { data, error } = await supabase
  .from("license_keys")
  .delete()
  .eq("key_value", keyToRemove)
  .select("id, product_slug, key_value, status");

if (error) {
  console.error("Failed:", error.message);
  process.exit(1);
}

if (!data.length) {
  console.log("Key not found:", keyToRemove);
} else {
  console.log("Removed:", data[0].product_slug, "→", data[0].key_value);
}

// Show remaining crusader keys
const { data: remaining } = await supabase
  .from("license_keys")
  .select("id, product_slug, key_value, status")
  .like("product_slug", "crusader-r6%");

console.log("\nRemaining Crusader keys:", remaining?.length || 0);
for (const key of remaining || []) {
  console.log(`  ${key.product_slug} → ${key.key_value} (${key.status})`);
}
