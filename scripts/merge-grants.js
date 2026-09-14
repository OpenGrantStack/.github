import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const mainPath = path.join(rootDir, "data", "grant-eligibility.json");
const languagesDir = path.join(rootDir, "data", "languages");
const outputPath = path.join(rootDir, "data", "grant-eligibility-merged.json");

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function loadYaml(filePath) {
  return yaml.load(fs.readFileSync(filePath, "utf-8"));
}

function merge() {
  const mainGrants = loadJson(mainPath);

  const files = fs
    .readdirSync(languagesDir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .sort();

  const seenIds = new Set();
  const merged = [];

  // Add main grants first
  for (const grant of mainGrants) {
    if (seenIds.has(grant.id)) {
      console.warn(`⚠️  Duplicate id in main file: ${grant.id}`);
      continue;
    }
    seenIds.add(grant.id);
    merged.push({ ...grant, source: "main" });
  }

  // Add language-specific grants
  for (const file of files) {
    const language = path.basename(file, path.extname(file));
    const entries = loadYaml(path.join(languagesDir, file));

    if (!Array.isArray(entries)) {
      console.warn(`⚠️  Skipping ${file}: not an array.`);
      continue;
    }

    for (const entry of entries) {
      if (seenIds.has(entry.id)) {
        console.warn(`⚠️  Duplicate id across files: ${entry.id} (in ${file})`);
        continue;
      }
      seenIds.add(entry.id);
      merged.push({ ...entry, source: "language", language });
    }
  }

  fs.writeFileSync(outputPath, JSON.stringify(merged, null, 2) + "\n");
  console.log(`✅ Merged ${merged.length} grant programs → ${path.relative(rootDir, outputPath)}`);
}

merge();