
scripts/validate-schemas.js

```javascript
#!/usr/bin/env node

/**
 * Schema Validation Script
 * Validates JSON schemas and example data against schemas
 */

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const yaml = require('js-yaml');

// Configuration
const SCHEMAS_DIR = path.join(__dirname, '../schemas');
const EXAMPLES_DIR = path.join(__dirname, '../examples');
const VALIDATION_REPORT = path.join(__dirname, '../validation-report.json');

class SchemaValidator {
  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      strict: true,
      validateSchema: true,
      verbose: true,
      discriminator: true
    });
    
    addFormats(this.ajv);
    this.registerCustomKeywords();
    
    this.results = {
      timestamp: new Date().toISOString(),
      schemas: {},
      examples: {},
      summary: {
        totalSchemas: 0,
        validSchemas: 0,
        totalExamples: 0,
        validExamples: 0,
        errors: []
      }
    };
  }

  registerCustomKeywords() {
    // Register custom validation keywords if needed
    this.ajv.addKeyword({
      keyword: 'complianceReference',
      schemaType: 'string',
      validate: (schema, data) => {
        // Custom validation for compliance references
        return typeof data === 'string' && data.length > 0;
      }
    });
  }

  validateSchemas() {
    console.log('🔍 Validating JSON schemas...');
    
    const schemaFiles = fs.readdirSync(SCHEMAS_DIR)
      .filter(file => file.endsWith('.json'));
    
    this.results.summary.totalSchemas = schemaFiles.length;
    
    schemaFiles.forEach(file => {
      const filePath = path.join(SCHEMAS_DIR, file);
      const schemaName = path.basename(file, '.json');
      
      try {
        const schema = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        // Validate schema structure
        const validateSchema = this.ajv.compile(schema);
        const isValid = this.ajv.validateSchema(schema);
        
        this.results.schemas[schemaName] = {
          valid: isValid,
          errors: isValid ? [] : this.ajv.errors || [],
          metadata: {
            $id: schema.$id,
            title: schema.title,
            description: schema.description,
            version: schema.$id ? schema.$id.match(/v(\d+\.\d+\.\d+)/)?.[1] : 'unknown'
          }
        };
        
        if (isValid) {
          this.results.summary.validSchemas++;
          console.log(`✅ ${schemaName}: Valid`);
        } else {
          console.log(`❌ ${schemaName}: Invalid`);
          console.error(this.ajv.errors);
        }
        
      } catch (error) {
        this.results.schemas[schemaName] = {
          valid: false,
          errors: [error.message],
          metadata: null
        };
        console.error(`❌ ${schemaName}: ${error.message}`);
      }
    });
  }

  validateExamples() {
    console.log('\n🔍 Validating example data...');
    
    const exampleFiles = fs.readdirSync(EXAMPLES_DIR)
      .filter(file => file.endsWith('.json'));
    
    this.results.summary.totalExamples = exampleFiles.length;
    
    exampleFiles.forEach(file => {
      const filePath = path.join(EXAMPLES_DIR, file);
      const exampleName = path.basename(file, '.json');
      
      try {
        const exampleData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        // Determine which schema to use based on filename or metadata
        const schemaName = this.determineSchemaForExample(exampleName, exampleData);
        
        if (!schemaName || !this.results.schemas[schemaName]?.valid) {
          console.log(`⚠️  ${exampleName}: No valid schema found`);
          return;
        }
        
        const schemaPath = path.join(SCHEMAS_DIR, `${schemaName}.json`);
        const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
        
        const validate = this.ajv.compile(schema);
        const isValid = validate(exampleData);
        
        this.results.examples[exampleName] = {
          valid: isValid,
          schema: schemaName,
          errors: isValid ? [] : validate.errors || []
        };
        
        if (isValid) {
          this.results.summary.validExamples++;
          console.log(`✅ ${exampleName}: Valid against ${schemaName}`);
        } else {
          console.log(`❌ ${exampleName}: Invalid against ${schemaName}`);
          console.error(validate.errors);
        }
        
      } catch (error) {
        this.results.examples[exampleName] = {
          valid: false,
          errors: [error.message],
          schema: null
        };
        console.error(`❌ ${exampleName}: ${error.message}`);
      }
    });
  }

  determineSchemaForExample(exampleName, exampleData) {
    // Map example names to schema names
    const nameMapping = {
      'grant-example': 'grant',
      'disbursement-example': 'disbursement',
      'audit-example': 'audit'
    };
    
    if (nameMapping[exampleName]) {
      return nameMapping[exampleName];
    }
    
    // Try to determine from data structure
    if (exampleData.grantId && exampleData.grantNumber) {
      return 'grant';
    } else if (exampleData.disbursementId && exampleData.grantId) {
      return 'disbursement';
    } else if (exampleData.auditId && exampleData.findings) {
      return 'audit';
    }
    
    return null;
  }

  validateCrossReferences() {
    console.log('\n🔗 Checking cross-references...');
    
    // Check that all $ref references are valid
    const errors = [];
    
    Object.keys(this.results.schemas).forEach(schemaName => {
      if (this.results.schemas[schemaName].valid) {
        const schemaPath = path.join(SCHEMAS_DIR, `${schemaName}.json`);
        const schemaContent = fs.readFileSync(schemaPath, 'utf8');
        
        // Find all $ref references
        const refRegex = /"\$ref"\s*:\s*"([^"]+)"/g;
        let match;
        
        while ((match = refRegex.exec(schemaContent)) !== null) {
          const ref = match[1];
          
          if (ref.startsWith('#')) {
            // Internal reference - should be valid
            continue;
          }
          
          if (ref.startsWith('https://json-schema.org/')) {
            // Standard schema reference
            continue;
          }
          
          if (ref.startsWith('https://grantready.org/schemas/')) {
            // External reference to another schema
            const refSchemaName = ref.match(/schemas\/([^/]+)\//)?.[1];
            if (refSchemaName && !this.results.schemas[refSchemaName]?.valid) {
              errors.push({
                schema: schemaName,
                reference: ref,
                error: `Referenced schema ${refSchemaName} not found or invalid`
              });
            }
          }
        }
      }
    });
    
    if (errors.length > 0) {
      console.log('❌ Cross-reference errors found:');
      errors.forEach(error => {
        console.error(`  ${error.schema}: ${error.error} (${error.reference})`);
      });
    } else {
      console.log('✅ All cross-references valid');
    }
    
    this.results.summary.crossReferenceErrors = errors;
  }

  generateReport() {
    console.log('\n📊 Generating validation report...');
    
    const summary = this.results.summary;
    summary.successRate = summary.totalSchemas > 0 
      ? (summary.validSchemas / summary.totalSchemas * 100).toFixed(1)
      : 0;
    
    // Write report
    fs.writeFileSync(
      VALIDATION_REPORT,
      JSON.stringify(this.results, null, 2),
      'utf8'
    );
    
    console.log(`\n📋 Summary:`);
    console.log(`  Schemas: ${summary.validSchemas}/${summary.totalSchemas} valid (${summary.successRate}%)`);
    console.log(`  Examples: ${summary.validExamples}/${summary.totalExamples} valid`);
    
    if (summary.crossReferenceErrors?.length > 0) {
      console.log(`  Cross-reference errors: ${summary.crossReferenceErrors.length}`);
    }
    
    console.log(`\n📄 Report saved to: ${VALIDATION_REPORT}`);
    
    // Exit with appropriate code
    if (summary.validSchemas < summary.totalSchemas || 
        summary.crossReferenceErrors?.length > 0) {
      process.exit(1);
    }
  }

  validate() {
    console.log('🚀 Starting schema validation...\n');
    
    this.validateSchemas();
    this.validateExamples();
    this.validateCrossReferences();
    this.generateReport();
  }
}

// Run validation
if (require.main === module) {
  const validator = new SchemaValidator();
  validator.validate();
}

module.exports = SchemaValidator;
