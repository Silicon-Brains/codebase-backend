import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
}

// Service-role client — lives only on the server, bypasses RLS.
// Every route MUST enforce its own access rules before using this.
export const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});
