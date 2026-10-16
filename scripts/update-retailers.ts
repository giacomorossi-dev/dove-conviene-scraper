// Builds the national retailer list into the data folder from the command
// line, the same (slow, polite) way the server does in the background:
// `bun run retailers:update`. Don't run it while the server is building.
import {
  DATA_DIR,
  getCatalogStatus,
  updateCatalog,
} from "../server/catalog-store";

console.log(`Building the retailer list into ${DATA_DIR} (about an hour)…`);
updateCatalog();
let last = "";
while (getCatalogStatus().building) {
  const { progress } = getCatalogStatus();
  const line = progress
    ? `${progress.phase} ${progress.done}/${progress.total}`
    : "";
  if (line !== last) console.log(line);
  last = line;
  await Bun.sleep(5_000);
}
const { error, count, updatedAt } = getCatalogStatus();
if (error) {
  console.error(`Failed: ${error} (progress is saved, run again to resume)`);
  process.exit(1);
}
console.log(`${count} retailers, updated ${updatedAt}`);
