import fs from "node:fs/promises";
import path from "node:path";

const inputDir = path.join(
  process.cwd(),
  "public",
  "data",
  "nccpl",
  "NCCPL Historical data"
);
const outputFile = path.join(
  process.cwd(),
  "public",
  "data",
  "nccpl",
  "foreign-investor-activity.history.raw.json"
);

function isValidDateString(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getDataArrayLength(entry) {
  return Array.isArray(entry?.data) ? entry.data.length : 0;
}

async function main() {
  const fileNames = await fs.readdir(inputDir);
  const jsonFiles = fileNames.filter((name) => name.toLowerCase().endsWith(".json"));

  const invalidJsonFiles = [];
  let filesRead = 0;
  let validEntriesBeforeDedupe = 0;
  const dedupedByDate = new Map();

  for (const fileName of jsonFiles) {
    const fullPath = path.join(inputDir, fileName);

    let parsed;
    try {
      const content = await fs.readFile(fullPath, "utf8");
      parsed = JSON.parse(content);
      filesRead += 1;
    } catch {
      invalidJsonFiles.push(fileName);
      continue;
    }

    if (!Array.isArray(parsed)) {
      continue;
    }

    for (const entry of parsed) {
      if (!isValidDateString(entry?.date)) {
        continue;
      }

      validEntriesBeforeDedupe += 1;
      const existing = dedupedByDate.get(entry.date);
      if (!existing || getDataArrayLength(entry) > getDataArrayLength(existing)) {
        dedupedByDate.set(entry.date, entry);
      }
    }
  }

  const merged = Array.from(dedupedByDate.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  await fs.writeFile(outputFile, `${JSON.stringify(merged, null, 2)}\n`, "utf8");

  if (invalidJsonFiles.length > 0) {
    console.warn("Skipped invalid JSON files:");
    for (const fileName of invalidJsonFiles) {
      console.warn(`- ${fileName}`);
    }
  }

  const earliestDate = merged.length > 0 ? merged[0].date : "N/A";
  const latestDate = merged.length > 0 ? merged[merged.length - 1].date : "N/A";

  console.log(`Files read: ${filesRead}`);
  console.log(`Valid entries before dedupe: ${validEntriesBeforeDedupe}`);
  console.log(`Unique dates after dedupe: ${merged.length}`);
  console.log(`Earliest date: ${earliestDate}`);
  console.log(`Latest date: ${latestDate}`);
  console.log(`Output file: ${outputFile}`);
}

main().catch((error) => {
  console.error("Failed to merge NCCPL history:", error);
  process.exitCode = 1;
});
