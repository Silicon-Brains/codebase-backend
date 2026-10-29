/**
 * Seed script (Phase 3; content extended in Phase 4 — see migrations/003).
 * Content lives in ./seed-data.ts.
 *
 * Populates `services`, `projects`, `faqs`, and `process_steps` with the same
 * copy that's currently hardcoded into the Phase 2 (public) pages, so the
 * pages can render from CMS fetches with no visible content change.
 *
 * `testimonials` is intentionally left untouched — no testimonial content
 * exists anywhere in the Phase 2 screenshots/pages to seed from. Add real
 * testimonials later via the admin CRUD routes once the client has copy.
 *
 * Idempotent: every table is upserted on its natural unique key (`slug` for
 * services/projects, `(page, sort_order)` for faqs, `phase_number` for
 * process_steps), so this is safe to re-run after a schema change or content
 * tweak without producing duplicate rows.
 *
 * Usage:
 *   npm run db:seed --workspace=apps/server
 */
import "dotenv/config";
import { supabase } from "../lib/supabase.js";
import { services, projects, faqs, processSteps } from "./seed-data.js";

async function upsert(table: string, rows: Record<string, unknown>[], conflictColumn: string) {
  const { error, count } = await supabase
    .from(table)
    .upsert(rows, { onConflict: conflictColumn, count: "exact" });
  if (error) {
    throw new Error(`Failed to seed "${table}": ${error.message}`);
  }
  console.log(`  ✓ ${table}: upserted ${rows.length} row(s)${count != null ? ` (count=${count})` : ""}`);
}

async function main() {
  console.log("Seeding SiliconBrains CMS content…\n");

  await upsert("services", services, "slug");
  await upsert("projects", projects, "slug");
  await upsert("faqs", faqs, "page,sort_order");
  await upsert("process_steps", processSteps, "phase_number");

  console.log("\nDone. Public routes (/api/services, /api/projects, /api/faqs?page=contact,");
  console.log("/api/process-steps) will now return this content instead of 404/empty arrays.");
  console.log('\nNote: "testimonials" was left untouched — no testimonial copy exists in the');
  console.log("Phase 2 pages to seed from. Add real ones later via POST /api/admin/testimonials.");
}

main()
  .catch((err) => {
    console.error("\nSeed failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => {
    // supabase-js keeps no open handles that need explicit closing, but being
    // explicit about intentional exit avoids the process hanging on some
    // Node/undici versions after many concurrent requests.
    process.exit(process.exitCode ?? 0);
  });
