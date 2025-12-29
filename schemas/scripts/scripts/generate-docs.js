
scripts/generate-docs.js

```javascript
#!/usr/bin/env node

/**
 * Documentation Generator
 * Generates comprehensive documentation from schemas and templates
 */

const fs = require('fs');
const path = require('path');
const marked = require('marked');
const handlebars = require('handlebars');
const { execSync } = require('child_process');

class DocumentationGenerator {
  constructor() {
    this.config = {
      inputDirs: {
        schemas: path.join(__dirname, '../schemas'),
        templates: path.join(__dirname, '../templates'),
        docs: path.join(__dirname, '../docs')
      },
      outputDir: path.join(__dirname, '../dist/docs'),
      templatesDir: path.join(__dirname, 'templates')
    };
    
    this.ensureDirectories();
    this.registerHelpers();
  }

  ensureDirectories() {
    [this.config.outputDir, this.config.templatesDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  registerHelpers() {
    handlebars.registerHelper('json', context => JSON.stringify(context, null, 2));
    handlebars.registerHelper('markdown', text => marked.parse(text || ''));
    handlebars.registerHelper('date', () => new Date().toISOString().split('T')[0]);
    handlebars.registerHelper('if_eq', function(a, b, opts) {
      return a === b ? opts.fn(this) : opts.inverse(this);
    });
  }

  loadSchemas() {
    console.log('📂 Loading schemas...');
    
    const schemas = {};
    const schemaFiles = fs.readdirSync(this.config.inputDirs.schemas)
      .filter(file => file.endsWith('.json'));
    
    schemaFiles.forEach(file => {
      const schemaPath = path.join(this.config.inputDirs.schemas, file);
      const schemaName = path.basename(file, '.json');
      
      try {
        const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
        schemas[schemaName] = {
          name: schemaName,
          data: schema,
          metadata: {
            title: schema.title,
            description: schema.description,
            version: schema.$id?.match(/v(\d+\.\d+\.\d+)/)?.[1] || '1.0.0',
            type: schema.type,
            required: schema.required || []
          },
          properties: this.extractProperties(schema)
        };
      } catch (error) {
        console.error(`Error loading schema ${file}:`, error.message);
      }
    });
    
    return schemas;
  }

  extractProperties(schema, path = '') {
    if (!schema.properties) return [];
    
    const properties = [];
    
    Object.entries(schema.properties).forEach(([key, prop]) => {
      const propPath = path ? `${path}.${key}` : key;
      
      const propertyInfo = {
        name: key,
        path: propPath,
        type: Array.isArray(prop.type) ? prop.type.join(' | ') : prop.type,
        description: prop.description || '',
        required: schema.required?.includes(key) || false,
        format: prop.format || '',
        enum: prop.enum || [],
        pattern: prop.pattern || '',
        minimum: prop.minimum,
        maximum: prop.maximum,
        example: prop.examples?.[0] || prop.default,
        properties: prop.properties ? this.extractProperties(prop, propPath) : []
      };
      
      if (prop.$ref) {
        propertyInfo.reference = prop.$ref;
      }
      
      properties.push(propertyInfo);
    });
    
    return properties;
  }

  loadTemplates() {
    console.log('📂 Loading document templates...');
    
    const templates = {};
    const templateFiles = fs.readdirSync(this.config.inputDirs.templates)
      .filter(file => file.endsWith('.md'));
    
    templateFiles.forEach(file => {
      const templatePath = path.join(this.config.inputDirs.templates, file);
      const templateName = path.basename(file, '.md');
      
      try {
        const content = fs.readFileSync(templatePath, 'utf8');
        
        // Extract metadata from frontmatter if present
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
        let metadata = {};
        let body = content;
        
        if (frontmatterMatch) {
          body = content.slice(frontmatterMatch[0].length);
          metadata = this.parseFrontmatter(frontmatterMatch[1]);
        }
        
        templates[templateName] = {
          name: templateName,
          content: body,
          metadata: metadata,
          html: marked.parse(body)
        };
      } catch (error) {
        console.error(`Error loading template ${file}:`, error.message);
      }
    });
    
    return templates;
  }

  parseFrontmatter(frontmatter) {
    const metadata = {};
    const lines = frontmatter.split('\n');
    
    lines.forEach(line => {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        const [, key, value] = match;
        metadata[key.trim()] = value.trim();
      }
    });
    
    return metadata;
  }

  generateSchemaDocumentation(schemas) {
    console.log('📝 Generating schema documentation...');
    
    const templatePath = path.join(this.config.templatesDir, 'schema-docs.hbs');
    let template;
    
    if (fs.existsSync(templatePath)) {
      template = handlebars.compile(fs.readFileSync(templatePath, 'utf8'));
    } else {
      // Create default template
      template = handlebars.compile(`
# Schema Documentation

Generated: {{date}}

## Available Schemas

{{#each schemas}}
### {{this.metadata.title}}
- **Name**: {{this.name}}
- **Version**: {{this.metadata.version}}
- **Type**: {{this.metadata.type}}
- **Description**: {{this.metadata.description}}

#### Properties
{{#each this.properties}}
##### {{this.path}}
- **Type**: {{this.type}}
- **Required**: {{this.required}}
- **Description**: {{this.description}}
{{#if this.format}}- **Format**: {{this.format}}{{/if}}
{{#if this.enum.length}}- **Allowed Values**: {{join this.enum ", "}}{{/if}}
{{#if this.pattern}}- **Pattern**: \`{{this.pattern}}\`{{/if}}
{{#if this.example}}- **Example**: \`{{json this.example}}\`{{/if}}

{{/each}}
{{/each}}
      `);
    }
    
    const output = template({ schemas: Object.values(schemas), date: new Date() });
    const outputPath = path.join(this.config.outputDir, 'schemas.md');
    
    fs.writeFileSync(outputPath, output, 'utf8');
    console.log(`✅ Schema documentation generated: ${outputPath}`);
    
    return outputPath;
  }

  generateTemplateDocumentation(templates) {
    console.log('📝 Generating template documentation...');
    
    const templatePath = path.join(this.config.templatesDir, 'template-docs.hbs');
    let template;
    
    if (fs.existsSync(templatePath)) {
      template = handlebars.compile(fs.readFileSync(templatePath, 'utf8'));
    } else {
      template = handlebars.compile(`
# Template Documentation

Generated: {{date}}

## Available Templates

{{#each templates}}
### {{this.name}}
{{#if this.metadata.description}}- **Description**: {{this.metadata.description}}{{/if}}
{{#if this.metadata.version}}- **Version**: {{this.metadata.version}}{{/if}}
{{#if this.metadata.lastUpdated}}- **Last Updated**: {{this.metadata.lastUpdated}}{{/if}}

#### Sections
{{#each (split this.content "## ")}}
{{#if this}}
##### {{firstLine this}}
{{trim (slice this (add (length (firstLine this)) 1))}}
{{/if}}
{{/each}}

{{/each}}
      `);
    }
    
    // Register custom helpers for this template
    handlebars.registerHelper('split', (str, delimiter) => str.split(delimiter));
    handlebars.registerHelper('firstLine', str => str.split('\n')[0]);
    handlebars.registerHelper('trim', str => str.trim());
    handlebars.registerHelper('slice', (str, start) => str.slice(start));
    handlebars.registerHelper('length', str => str.length);
    handlebars.registerHelper('add', (a, b) => a + b);
    
    const output = template({ 
      templates: Object.values(templates), 
      date: new Date().toISOString().split('T')[0] 
    });
    const outputPath = path.join(this.config.outputDir, 'templates.md');
    
    fs.writeFileSync(outputPath, output, 'utf8');
    console.log(`✅ Template documentation generated: ${outputPath}`);
    
    return outputPath;
  }

  generateAPIDocumentation(schemas) {
    console.log('📝 Generating API documentation...');
    
    const template = `
# API Documentation

Generated: {{date}}

## Data Models

{{#each schemas}}
### {{this.metadata.title}} Model

\`\`\`typescript
interface {{pascalCase this.name}} {
{{#each this.properties}}
  {{this.name}}{{#unless this.required}}?{{/unless}}: {{typescriptType this}};
{{/each}}
}
\`\`\`

#### Field Descriptions
{{#each this.properties}}
- **{{this.name}}** ({{this.type}}{{#if this.format}}, {{this.format}}{{/if}}): {{this.description}}
{{/each}}

{{/each}}

## Validation Rules

Each schema includes the following validation rules:
- Required fields as specified
- Type checking
- Format validation (email, date, etc.)
- Pattern matching for strings
- Minimum/maximum for numbers
- Enum validation for allowed values

## Usage Examples

### JavaScript/Node.js
\`\`\`javascript
const Ajv = require('ajv');
const {{firstSchema}}Schema = require('./schemas/{{firstSchema}}.json');

const ajv = new Ajv();
const validate = ajv.compile({{firstSchema}}Schema);

const data = { /* your data */ };
const valid = validate(data);

if (!valid) {
  console.error(validate.errors);
}
\`\`\`

### TypeScript
\`\`\`typescript
import {{pascalCase firstSchema}}Schema from './schemas/{{firstSchema}}.json';

type {{pascalCase firstSchema}} = typeof {{pascalCase firstSchema}}Schema;

function validate{{pascalCase firstSchema}}(data: unknown): {{pascalCase firstSchema}} {
  // Validation logic
  return data as {{pascalCase firstSchema}};
}
\`\`\`
    `;
    
    handlebars.registerHelper('pascalCase', str => 
      str.replace(/(^\w|-\w)/g, match => match.replace('-', '').toUpperCase())
    );
    
    handlebars.registerHelper('typescriptType', prop => {
      if (prop.enum.length > 0) {
        return prop.enum.map(v => `'${v}'`).join(' | ');
      }
      
      const typeMap = {
        'string': 'string',
        'number': 'number',
        'integer': 'number',
        'boolean': 'boolean',
        'array': 'any[]',
        'object': 'Record<string, any>'
      };
      
      return typeMap[prop.type] || 'any';
    });
    
    handlebars.registerHelper('firstSchema', () => Object.keys(schemas)[0]);
    
    const compiled = handlebars.compile(template);
    const output = compiled({ 
      schemas: Object.values(schemas), 
      date: new Date().toISOString().split('T')[0] 
    });
    
    const outputPath = path.join(this.config.outputDir, 'api.md');
    fs.writeFileSync(outputPath, output, 'utf8');
    console.log(`✅ API documentation generated: ${outputPath}`);
    
    return outputPath;
  }

  generateComplianceMatrix() {
    console.log('📝 Generating compliance matrix...');
    
    const matrix = {
      '2 CFR Part 200': {
        'Financial Management': ['grant.json', 'disbursement.json'],
        'Procurement': ['grant.json'],
        'Property Management': ['grant.json'],
        'Reporting': ['reporting-template.md', 'grant.json'],
        'Audit': ['audit.json', 'audit-readiness.md']
      },
      'OMB Circular A-133': {
        'Single Audit': ['audit.json', 'audit-readiness.md'],
        'Schedule of Expenditures': ['grant.json', 'disbursement.json']
      },
      'ADA/Section 504': {
        'Accessibility': ['compliance-attestation.md'],
        'Non-discrimination': ['compliance-attestation.md']
      }
    };
    
    const template = `
# Compliance Matrix

Generated: {{date}}

This matrix shows how documentation and schemas align with regulatory requirements.

## Regulatory Framework Coverage

{{#each matrix}}
### {{@key}}
{{#each this}}
- **{{@key}}**: {{#each this}}[{{this}}](/{{this}}) {{/each}}
{{/each}}
{{/each}}

## Validation Status

| Requirement | Documentation | Schema | Template | Status |
|-------------|---------------|--------|----------|--------|
| 2 CFR 200.300 Financial Systems | [docs/compliance-overview.md](/docs/compliance-overview.md) | [grant.json](/schemas/grant.json) | [compliance-attestation.md](/templates/compliance-attestation.md) | ✅ Complete |
| 2 CFR 200.328 Reporting | [docs/audit-readiness.md](/docs/audit-readiness.md) | [grant.json](/schemas/grant.json) | [reporting-template.md](/templates/reporting-template.md) | ✅ Complete |
| 2 CFR 200.430 Compensation | [docs/compliance-overview.md](/docs/compliance-overview.md) | [grant.json](/schemas/grant.json) | [compliance-attestation.md](/templates/compliance-attestation.md) | ✅ Complete |
| ADA Title II | [docs/compliance-overview.md](/docs/compliance-overview.md) | N/A | [compliance-attestation.md](/templates/compliance-attestation.md) | ✅ Complete |

## Gap Analysis

### Missing Coverage
1. State-specific requirements for California
2. International funding requirements
3. Specific agency requirements (NIH, NSF, etc.)

### Planned Enhancements
1. Add state compliance templates
2. Create international funding schemas
3. Develop agency-specific checklists
    `;
    
    const compiled = handlebars.compile(template);
    const output = compiled({ 
      matrix, 
      date: new Date().toISOString().split('T')[0] 
    });
    
    const outputPath = path.join(this.config.outputDir, 'compliance-matrix.md');
    fs.writeFileSync(outputPath, output, 'utf8');
    console.log(`✅ Compliance matrix generated: ${outputPath}`);
    
    return outputPath;
  }

  generateIndex() {
    console.log('📝 Generating index...');
    
    const files = fs.readdirSync(this.config.outputDir)
      .filter(file => file.endsWith('.md'))
      .map(file => ({
        name: file.replace('.md', ''),
        path: file,
        title: this.getTitleFromFile(path.join(this.config.outputDir, file))
      }));
    
    const template = `
# Documentation Index

Generated: {{date}}

## Available Documentation

{{#each files}}
### [{{this.title}}]({{this.path}})
{{this.name}} documentation

{{/each}}

## Navigation

- **Schemas**: Data structure definitions and validation rules
- **Templates**: Ready-to-use document templates
- **API**: Integration guidelines and examples
- **Compliance**: Regulatory alignment matrix

## Usage

All documentation is automatically generated from source files in the repository.
To regenerate documentation, run:

\`\`\`bash
npm run docs:generate
\`\`\`
    `;
    
    const compiled = handlebars.compile(template);
    const output = compiled({ 
      files, 
      date: new Date().toISOString().split('T')[0] 
    });
    
    const outputPath = path.join(this.config.outputDir, 'index.md');
    fs.writeFileSync(outputPath, output, 'utf8');
    console.log(`✅ Index generated: ${outputPath}`);
    
    return outputPath;
  }

  getTitleFromFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const titleMatch = content.match(/^#\s+(.+)$/m);
      return titleMatch ? titleMatch[1] : path.basename(filePath, '.md');
    } catch {
      return path.basename(filePath, '.md');
    }
  }

  generateAll() {
    console.log('🚀 Starting documentation generation...\n');
    
    const schemas = this.loadSchemas();
    const templates = this.loadTemplates();
    
    const generatedFiles = [
      this.generateSchemaDocumentation(schemas),
      this.generateTemplateDocumentation(templates),
      this.generateAPIDocumentation(schemas),
      this.generateComplianceMatrix(),
      this.generateIndex()
    ];
    
    console.log('\n🎉 Documentation generation complete!');
    console.log(`\nGenerated files in ${this.config.outputDir}:`);
    generatedFiles.forEach(file => {
      console.log(`  📄 ${path.relative(process.cwd(), file)}`);
    });
    
    // Generate PDF versions if wkhtmltopdf is available
    this.generatePDFsIfAvailable();
    
    return generatedFiles;
  }

  generatePDFsIfAvailable() {
    try {
      execSync('which wkhtmltopdf', { stdio: 'ignore' });
      console.log('\n📄 Generating PDF versions...');
      
      const mdFiles = fs.readdirSync(this.config.outputDir)
        .filter(file => file.endsWith('.md'));
      
      mdFiles.forEach(file => {
        const mdPath = path.join(this.config.outputDir, file);
        const pdfPath = path.join(this.config.outputDir, file.replace('.md', '.pdf'));
        
        try {
          // Convert markdown to HTML first
          const mdContent = fs.readFileSync(mdPath, 'utf8');
          const htmlContent = marked.parse(mdContent);
          const htmlPath = mdPath.replace('.md', '.html');
          
          fs.writeFileSync(htmlPath, `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <title>${path.basename(file, '.md')}</title>
              <style>
                body { font-family: Arial, sans-serif; margin: 40px; }
                h1 { color: #2c3e50; }
                h2 { color: #34495e; border-bottom: 1px solid #eee; padding-bottom: 10px; }
                code { background: #f5f5f5; padding: 2px 4px; border-radius: 3px; }
                pre { background: #f5f5f5; padding: 10px; border-radius: 3px; overflow: auto; }
                table { border-collapse: collapse; width: 100%; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
              </style>
            </head>
            <body>
              ${htmlContent}
            </body>
            </html>
          `);
          
          // Convert HTML to PDF
          execSync(`wkhtmltopdf --page-size Letter --margin-top 20mm --margin-bottom 20mm --margin-left 20mm --margin-right 20mm "${htmlPath}" "${pdfPath}"`, {
            stdio: 'pipe'
          });
          
          console.log(`  ✅ ${file} → PDF`);
          
          // Clean up HTML file
          fs.unlinkSync(htmlPath);
          
        } catch (error) {
          console.warn(`  ⚠️  Failed to generate PDF for ${file}: ${error.message}`);
        }
      });
      
    } catch {
      console.log('\n⚠️  wkhtmltopdf not available, skipping PDF generation');
      console.log('  Install with: brew install wkhtmltopdf (Mac) or apt-get install wkhtmltopdf (Linux)');
    }
  }
}

// Run generator
if (require.main === module) {
  const generator = new DocumentationGenerator();
  generator.generateAll();
}

module.exports = DocumentationGenerator;
scripts/generate-docs.js

```javascript
#!/usr/bin/env node

/**
 * Documentation Generator
 * Generates comprehensive documentation from schemas and templates
 */

const fs = require('fs');
const path = require('path');
const marked = require('marked');
const handlebars = require('handlebars');
const { execSync } = require('child_process');

class DocumentationGenerator {
  constructor() {
    this.config = {
      inputDirs: {
        schemas: path.join(__dirname, '../schemas'),
        templates: path.join(__dirname, '../templates'),
        docs: path.join(__dirname, '../docs')
      },
      outputDir: path.join(__dirname, '../dist/docs'),
      templatesDir: path.join(__dirname, 'templates')
    };
    
    this.ensureDirectories();
    this.registerHelpers();
  }

  ensureDirectories() {
    [this.config.outputDir, this.config.templatesDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  registerHelpers() {
    handlebars.registerHelper('json', context => JSON.stringify(context, null, 2));
    handlebars.registerHelper('markdown', text => marked.parse(text || ''));
    handlebars.registerHelper('date', () => new Date().toISOString().split('T')[0]);
    handlebars.registerHelper('if_eq', function(a, b, opts) {
      return a === b ? opts.fn(this) : opts.inverse(this);
    });
  }

  loadSchemas() {
    console.log('📂 Loading schemas...');
    
    const schemas = {};
    const schemaFiles = fs.readdirSync(this.config.inputDirs.schemas)
      .filter(file => file.endsWith('.json'));
    
    schemaFiles.forEach(file => {
      const schemaPath = path.join(this.config.inputDirs.schemas, file);
      const schemaName = path.basename(file, '.json');
      
      try {
        const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
        schemas[schemaName] = {
          name: schemaName,
          data: schema,
          metadata: {
            title: schema.title,
            description: schema.description,
            version: schema.$id?.match(/v(\d+\.\d+\.\d+)/)?.[1] || '1.0.0',
            type: schema.type,
            required: schema.required || []
          },
          properties: this.extractProperties(schema)
        };
      } catch (error) {
        console.error(`Error loading schema ${file}:`, error.message);
      }
    });
    
    return schemas;
  }

  extractProperties(schema, path = '') {
    if (!schema.properties) return [];
    
    const properties = [];
    
    Object.entries(schema.properties).forEach(([key, prop]) => {
      const propPath = path ? `${path}.${key}` : key;
      
      const propertyInfo = {
        name: key,
        path: propPath,
        type: Array.isArray(prop.type) ? prop.type.join(' | ') : prop.type,
        description: prop.description || '',
        required: schema.required?.includes(key) || false,
        format: prop.format || '',
        enum: prop.enum || [],
        pattern: prop.pattern || '',
        minimum: prop.minimum,
        maximum: prop.maximum,
        example: prop.examples?.[0] || prop.default,
        properties: prop.properties ? this.extractProperties(prop, propPath) : []
      };
      
      if (prop.$ref) {
        propertyInfo.reference = prop.$ref;
      }
      
      properties.push(propertyInfo);
    });
    
    return properties;
  }

  loadTemplates() {
    console.log('📂 Loading document templates...');
    
    const templates = {};
    const templateFiles = fs.readdirSync(this.config.inputDirs.templates)
      .filter(file => file.endsWith('.md'));
    
    templateFiles.forEach(file => {
      const templatePath = path.join(this.config.inputDirs.templates, file);
      const templateName = path.basename(file, '.md');
      
      try {
        const content = fs.readFileSync(templatePath, 'utf8');
        
        // Extract metadata from frontmatter if present
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
        let metadata = {};
        let body = content;
        
        if (frontmatterMatch) {
          body = content.slice(frontmatterMatch[0].length);
          metadata = this.parseFrontmatter(frontmatterMatch[1]);
        }
        
        templates[templateName] = {
          name: templateName,
          content: body,
          metadata: metadata,
          html: marked.parse(body)
        };
      } catch (error) {
        console.error(`Error loading template ${file}:`, error.message);
      }
    });
    
    return templates;
  }

  parseFrontmatter(frontmatter) {
    const metadata = {};
    const lines = frontmatter.split('\n');
    
    lines.forEach(line => {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        const [, key, value] = match;
        metadata[key.trim()] = value.trim();
      }
    });
    
    return metadata;
  }

  generateSchemaDocumentation(schemas) {
    console.log('📝 Generating schema documentation...');
    
    const templatePath = path.join(this.config.templatesDir, 'schema-docs.hbs');
    let template;
    
    if (fs.existsSync(templatePath)) {
      template = handlebars.compile(fs.readFileSync(templatePath, 'utf8'));
    } else {
      // Create default template
      template = handlebars.compile(`
# Schema Documentation

Generated: {{date}}

## Available Schemas

{{#each schemas}}
### {{this.metadata.title}}
- **Name**: {{this.name}}
- **Version**: {{this.metadata.version}}
- **Type**: {{this.metadata.type}}
- **Description**: {{this.metadata.description}}

#### Properties
{{#each this.properties}}
##### {{this.path}}
- **Type**: {{this.type}}
- **Required**: {{this.required}}
- **Description**: {{this.description}}
{{#if this.format}}- **Format**: {{this.format}}{{/if}}
{{#if this.enum.length}}- **Allowed Values**: {{join this.enum ", "}}{{/if}}
{{#if this.pattern}}- **Pattern**: \`{{this.pattern}}\`{{/if}}
{{#if this.example}}- **Example**: \`{{json this.example}}\`{{/if}}

{{/each}}
{{/each}}
      `);
    }
    
    const output = template({ schemas: Object.values(schemas), date: new Date() });
    const outputPath = path.join(this.config.outputDir, 'schemas.md');
    
    fs.writeFileSync(outputPath, output, 'utf8');
    console.log(`✅ Schema documentation generated: ${outputPath}`);
    
    return outputPath;
  }

  generateTemplateDocumentation(templates) {
    console.log('📝 Generating template documentation...');
    
    const templatePath = path.join(this.config.templatesDir, 'template-docs.hbs');
    let template;
    
    if (fs.existsSync(templatePath)) {
      template = handlebars.compile(fs.readFileSync(templatePath, 'utf8'));
    } else {
      template = handlebars.compile(`
# Template Documentation

Generated: {{date}}

## Available Templates

{{#each templates}}
### {{this.name}}
{{#if this.metadata.description}}- **Description**: {{this.metadata.description}}{{/if}}
{{#if this.metadata.version}}- **Version**: {{this.metadata.version}}{{/if}}
{{#if this.metadata.lastUpdated}}- **Last Updated**: {{this.metadata.lastUpdated}}{{/if}}

#### Sections
{{#each (split this.content "## ")}}
{{#if this}}
##### {{firstLine this}}
{{trim (slice this (add (length (firstLine this)) 1))}}
{{/if}}
{{/each}}

{{/each}}
      `);
    }
    
    // Register custom helpers for this template
    handlebars.registerHelper('split', (str, delimiter) => str.split(delimiter));
    handlebars.registerHelper('firstLine', str => str.split('\n')[0]);
    handlebars.registerHelper('trim', str => str.trim());
    handlebars.registerHelper('slice', (str, start) => str.slice(start));
    handlebars.registerHelper('length', str => str.length);
    handlebars.registerHelper('add', (a, b) => a + b);
    
    const output = template({ 
      templates: Object.values(templates), 
      date: new Date().toISOString().split('T')[0] 
    });
    const outputPath = path.join(this.config.outputDir, 'templates.md');
    
    fs.writeFileSync(outputPath, output, 'utf8');
    console.log(`✅ Template documentation generated: ${outputPath}`);
    
    return outputPath;
  }

  generateAPIDocumentation(schemas) {
    console.log('📝 Generating API documentation...');
    
    const template = `
# API Documentation

Generated: {{date}}

## Data Models

{{#each schemas}}
### {{this.metadata.title}} Model

\`\`\`typescript
interface {{pascalCase this.name}} {
{{#each this.properties}}
  {{this.name}}{{#unless this.required}}?{{/unless}}: {{typescriptType this}};
{{/each}}
}
\`\`\`

#### Field Descriptions
{{#each this.properties}}
- **{{this.name}}** ({{this.type}}{{#if this.format}}, {{this.format}}{{/if}}): {{this.description}}
{{/each}}

{{/each}}

## Validation Rules

Each schema includes the following validation rules:
- Required fields as specified
- Type checking
- Format validation (email, date, etc.)
- Pattern matching for strings
- Minimum/maximum for numbers
- Enum validation for allowed values

## Usage Examples

### JavaScript/Node.js
\`\`\`javascript
const Ajv = require('ajv');
const {{firstSchema}}Schema = require('./schemas/{{firstSchema}}.json');

const ajv = new Ajv();
const validate = ajv.compile({{firstSchema}}Schema);

const data = { /* your data */ };
const valid = validate(data);

if (!valid) {
  console.error(validate.errors);
}
\`\`\`

### TypeScript
\`\`\`typescript
import {{pascalCase firstSchema}}Schema from './schemas/{{firstSchema}}.json';

type {{pascalCase firstSchema}} = typeof {{pascalCase firstSchema}}Schema;

function validate{{pascalCase firstSchema}}(data: unknown): {{pascalCase firstSchema}} {
  // Validation logic
  return data as {{pascalCase firstSchema}};
}
\`\`\`
    `;
    
    handlebars.registerHelper('pascalCase', str => 
      str.replace(/(^\w|-\w)/g, match => match.replace('-', '').toUpperCase())
    );
    
    handlebars.registerHelper('typescriptType', prop => {
      if (prop.enum.length > 0) {
        return prop.enum.map(v => `'${v}'`).join(' | ');
      }
      
      const typeMap = {
        'string': 'string',
        'number': 'number',
        'integer': 'number',
        'boolean': 'boolean',
        'array': 'any[]',
        'object': 'Record<string, any>'
      };
      
      return typeMap[prop.type] || 'any';
    });
    
    handlebars.registerHelper('firstSchema', () => Object.keys(schemas)[0]);
    
    const compiled = handlebars.compile(template);
    const output = compiled({ 
      schemas: Object.values(schemas), 
      date: new Date().toISOString().split('T')[0] 
    });
    
    const outputPath = path.join(this.config.outputDir, 'api.md');
    fs.writeFileSync(outputPath, output, 'utf8');
    console.log(`✅ API documentation generated: ${outputPath}`);
    
    return outputPath;
  }

  generateComplianceMatrix() {
    console.log('📝 Generating compliance matrix...');
    
    const matrix = {
      '2 CFR Part 200': {
        'Financial Management': ['grant.json', 'disbursement.json'],
        'Procurement': ['grant.json'],
        'Property Management': ['grant.json'],
        'Reporting': ['reporting-template.md', 'grant.json'],
        'Audit': ['audit.json', 'audit-readiness.md']
      },
      'OMB Circular A-133': {
        'Single Audit': ['audit.json', 'audit-readiness.md'],
        'Schedule of Expenditures': ['grant.json', 'disbursement.json']
      },
      'ADA/Section 504': {
        'Accessibility': ['compliance-attestation.md'],
        'Non-discrimination': ['compliance-attestation.md']
      }
    };
    
    const template = `
# Compliance Matrix

Generated: {{date}}

This matrix shows how documentation and schemas align with regulatory requirements.

## Regulatory Framework Coverage

{{#each matrix}}
### {{@key}}
{{#each this}}
- **{{@key}}**: {{#each this}}[{{this}}](/{{this}}) {{/each}}
{{/each}}
{{/each}}

## Validation Status

| Requirement | Documentation | Schema | Template | Status |
|-------------|---------------|--------|----------|--------|
| 2 CFR 200.300 Financial Systems | [docs/compliance-overview.md](/docs/compliance-overview.md) | [grant.json](/schemas/grant.json) | [compliance-attestation.md](/templates/compliance-attestation.md) | ✅ Complete |
| 2 CFR 200.328 Reporting | [docs/audit-readiness.md](/docs/audit-readiness.md) | [grant.json](/schemas/grant.json) | [reporting-template.md](/templates/reporting-template.md) | ✅ Complete |
| 2 CFR 200.430 Compensation | [docs/compliance-overview.md](/docs/compliance-overview.md) | [grant.json](/schemas/grant.json) | [compliance-attestation.md](/templates/compliance-attestation.md) | ✅ Complete |
| ADA Title II | [docs/compliance-overview.md](/docs/compliance-overview.md) | N/A | [compliance-attestation.md](/templates/compliance-attestation.md) | ✅ Complete |

## Gap Analysis

### Missing Coverage
1. State-specific requirements for California
2. International funding requirements
3. Specific agency requirements (NIH, NSF, etc.)

### Planned Enhancements
1. Add state compliance templates
2. Create international funding schemas
3. Develop agency-specific checklists
    `;
    
    const compiled = handlebars.compile(template);
    const output = compiled({ 
      matrix, 
      date: new Date().toISOString().split('T')[0] 
    });
    
    const outputPath = path.join(this.config.outputDir, 'compliance-matrix.md');
    fs.writeFileSync(outputPath, output, 'utf8');
    console.log(`✅ Compliance matrix generated: ${outputPath}`);
    
    return outputPath;
  }

  generateIndex() {
    console.log('📝 Generating index...');
    
    const files = fs.readdirSync(this.config.outputDir)
      .filter(file => file.endsWith('.md'))
      .map(file => ({
        name: file.replace('.md', ''),
        path: file,
        title: this.getTitleFromFile(path.join(this.config.outputDir, file))
      }));
    
    const template = `
# Documentation Index

Generated: {{date}}

## Available Documentation

{{#each files}}
### [{{this.title}}]({{this.path}})
{{this.name}} documentation

{{/each}}

## Navigation

- **Schemas**: Data structure definitions and validation rules
- **Templates**: Ready-to-use document templates
- **API**: Integration guidelines and examples
- **Compliance**: Regulatory alignment matrix

## Usage

All documentation is automatically generated from source files in the repository.
To regenerate documentation, run:

\`\`\`bash
npm run docs:generate
\`\`\`
    `;
    
    const compiled = handlebars.compile(template);
    const output = compiled({ 
      files, 
      date: new Date().toISOString().split('T')[0] 
    });
    
    const outputPath = path.join(this.config.outputDir, 'index.md');
    fs.writeFileSync(outputPath, output, 'utf8');
    console.log(`✅ Index generated: ${outputPath}`);
    
    return outputPath;
  }

  getTitleFromFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const titleMatch = content.match(/^#\s+(.+)$/m);
      return titleMatch ? titleMatch[1] : path.basename(filePath, '.md');
    } catch {
      return path.basename(filePath, '.md');
    }
  }

  generateAll() {
    console.log('🚀 Starting documentation generation...\n');
    
    const schemas = this.loadSchemas();
    const templates = this.loadTemplates();
    
    const generatedFiles = [
      this.generateSchemaDocumentation(schemas),
      this.generateTemplateDocumentation(templates),
      this.generateAPIDocumentation(schemas),
      this.generateComplianceMatrix(),
      this.generateIndex()
    ];
    
    console.log('\n🎉 Documentation generation complete!');
    console.log(`\nGenerated files in ${this.config.outputDir}:`);
    generatedFiles.forEach(file => {
      console.log(`  📄 ${path.relative(process.cwd(), file)}`);
    });
    
    // Generate PDF versions if wkhtmltopdf is available
    this.generatePDFsIfAvailable();
    
    return generatedFiles;
  }

  generatePDFsIfAvailable() {
    try {
      execSync('which wkhtmltopdf', { stdio: 'ignore' });
      console.log('\n📄 Generating PDF versions...');
      
      const mdFiles = fs.readdirSync(this.config.outputDir)
        .filter(file => file.endsWith('.md'));
      
      mdFiles.forEach(file => {
        const mdPath = path.join(this.config.outputDir, file);
        const pdfPath = path.join(this.config.outputDir, file.replace('.md', '.pdf'));
        
        try {
          // Convert markdown to HTML first
          const mdContent = fs.readFileSync(mdPath, 'utf8');
          const htmlContent = marked.parse(mdContent);
          const htmlPath = mdPath.replace('.md', '.html');
          
          fs.writeFileSync(htmlPath, `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <title>${path.basename(file, '.md')}</title>
              <style>
                body { font-family: Arial, sans-serif; margin: 40px; }
                h1 { color: #2c3e50; }
                h2 { color: #34495e; border-bottom: 1px solid #eee; padding-bottom: 10px; }
                code { background: #f5f5f5; padding: 2px 4px; border-radius: 3px; }
                pre { background: #f5f5f5; padding: 10px; border-radius: 3px; overflow: auto; }
                table { border-collapse: collapse; width: 100%; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
              </style>
            </head>
            <body>
              ${htmlContent}
            </body>
            </html>
          `);
          
          // Convert HTML to PDF
          execSync(`wkhtmltopdf --page-size Letter --margin-top 20mm --margin-bottom 20mm --margin-left 20mm --margin-right 20mm "${htmlPath}" "${pdfPath}"`, {
            stdio: 'pipe'
          });
          
          console.log(`  ✅ ${file} → PDF`);
          
          // Clean up HTML file
          fs.unlinkSync(htmlPath);
          
        } catch (error) {
          console.warn(`  ⚠️  Failed to generate PDF for ${file}: ${error.message}`);
        }
      });
      
    } catch {
      console.log('\n⚠️  wkhtmltopdf not available, skipping PDF generation');
      console.log('  Install with: brew install wkhtmltopdf (Mac) or apt-get install wkhtmltopdf (Linux)');
    }
  }
}

// Run generator
if (require.main === module) {
  const generator = new DocumentationGenerator();
  generator.generateAll();
}

module.exports = DocumentationGenerator;
