import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import yaml from "js-yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const schemaPath = path.join(rootDir, "schemas", "grant-program.schema.json");
const languagesDir = path.join(rootDir, "data", "languages");

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function loadYaml(filePath) {
  return yaml.load(fs.readFileSync(filePath, "utf-8"));
}

function validateLanguages() {
  const schema = loadJson(schemaPath);
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validateItem = ajv.compile(schema);

  const files = fs
    .readdirSync(languagesDir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));

  if (files.length === 0) {
    console.warn("⚠️  No language YAML files found in data/languages/");
    return;
  }

  let hasErrors = false;

  for (const file of files) {
    const filePath = path.join(languagesDir, file);
    const entries = loadYaml(filePath);

    if (!Array.isArray(entries)) {
      console.error(`❌ ${file}: must contain a YAML array of grant programs.`);
      hasErrors = true;
      continue;
    }

    entries.forEach((item, index) => {
      const valid = validateItem(item);
      if (!valid) {
        hasErrors = true;
        console.error(
          `\n❌ ${file} entry #${index + 1} (id: ${item.id ?? "unknown"}):`
        );
        for (const err of validateItem.errors) {
          console.error(`   - ${err.instancePath || "/"} ${err.message}`);
        }
      } else {
        console.log(`✅ ${file} #${index + 1} (id: ${item.id}) is valid.`);
      }
    });
  }

  if (hasErrors) {
    console.error("\n❌ Language validation failed.");
    process.exit(1);
  } else {
    console.log(`\n✅ All language files (${files.length}) are valid.`);
  }
}

validateLanguages();