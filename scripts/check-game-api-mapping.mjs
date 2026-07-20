#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const guide = readFileSync(join(root, "docs-game-api", "model-vs-compute.md"), "utf8");
const catalogPath = join(root, "..", "project-root-docs", "game-kit-program", "02-abstraction-catalog.md");
const catalog = existsSync(catalogPath) ? readFileSync(catalogPath, "utf8") : null;

// The definitive 16 carried + 14 new abstractions. Keep this list explicit:
// changing the catalog requires an intentional docs/CI update.
const abstractions = [
  "inventory", "locks", "npcs", "plots", "economy", "progression", "loot",
  "quests", "combat", "matches", "decks", "worldsim", "guild", "social",
  "leaderboards", "features",
  "ai", "mobs", "director", "movement", "abilities", "instances",
  "matchmaking", "territory", "pets", "racing", "minigames", "liveops",
  "moderation", "telemetry",
];

if (new Set(abstractions).size !== 30) {
  throw new Error("mapping registry must contain exactly 30 unique abstractions");
}
const missingGuide = abstractions.filter(
  (name) => !new RegExp(`\\b${name}\\b`, "i").test(guide),
);
if (missingGuide.length) {
  throw new Error(`Choosing Game APIs is missing: ${missingGuide.join(", ")}`);
}
if (catalog) {
  const missingCatalog = abstractions.filter(
    (name) => !catalog.includes(`\`${name}\``),
  );
  if (missingCatalog.length) {
    throw new Error(`abstraction catalog is missing: ${missingCatalog.join(", ")}`);
  }
}
console.log(`game API mapping: ${abstractions.length}/30 abstractions present`);
