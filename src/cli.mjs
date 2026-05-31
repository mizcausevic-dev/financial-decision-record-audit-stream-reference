import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { orchestrate } from "./orchestrator.mjs";
import { verify } from "./verifier.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_STREAM = resolve(HERE, "../examples/meridian-creditmind-reference-stream.ndjson");

const { events, denials } = orchestrate();
const result = verify(events);

mkdirSync(dirname(OUT_STREAM), { recursive: true });
writeFileSync(OUT_STREAM, events.map((e) => JSON.stringify(e)).join("\n") + "\n", "utf8");

console.log(`Built ${events.length} events → ${OUT_STREAM}`);
if (denials.length) {
  console.log(`Vault denied ${denials.length} step(s):`);
  for (const d of denials) console.log(`  - ${d.event_id}: ${d.reason}`);
}
if (!result.ok) {
  console.error("\nFAIL · verifier:");
  for (const e of result.errors) console.error("  ✗", e);
  process.exit(1);
}
console.log(`OK · ${events.length} events · chain ✓ · 2 invariants ✓ (FCRA §604 permissible-purpose + human-credit-officer)`);
