import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const schemaPath = path.join(rootDir, "schemas", "grant-program.schema.json");
const dataPath = path.join(rootDir, "data", "grant-eligibility.json");

function loadJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

function validate() {
  const schema = loadJson(schemaPath);
  const data = loadJson(dataPath);

  if (!Array.isArray(data)) {
    console.error("❌ Data file must contain an array of grant programs.");
    process.exit(1);
  }

  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);

  const validateItem = ajv.compile(schema);

  let hasErrors = false;

  data.forEach((item, index) => {
    const valid = validateItem(item);
    if (!valid) {
      hasErrors = true;
      console.error(`\n❌ Validation failed for entry #${index + 1} (id: ${item.id ?? "unknown"}):`);
      for (const err of validateItem.errors) {
        console.error(`   - ${err.instancePath || "/"} ${err.message}`);
      }
    } else {
      console.log(`✅ Entry #${index + 1} (id: ${item.id}) is valid.`);
    }
  });

  if (hasErrors) {
    console.error("\n❌ Validation failed. Please fix the errors above.");
    process.exit(1);
  } else {
    console.log(`\n✅ All ${data.length} grant programs are valid.`);
  }
}

validate();