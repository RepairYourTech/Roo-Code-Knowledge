# Tree-sitter Query Validation Guide

This guide explains how to validate tree-sitter queries and fix any issues that might arise.

## Overview

The tree-sitter query validation system ensures that language-specific queries work correctly against test fixtures. This is critical for the code indexing functionality to properly identify and extract code elements.

## Running the Validation Script

### Using npm scripts (Recommended)

The validation script is configured to run with ts-node to properly handle TypeScript query files:

```bash
# Validate all languages
npm run validate-queries

# Validate specific language
npm run validate-queries -- --language=typescript

# Enable verbose output
npm run validate-queries -- --verbose

# Validate multiple specific languages
npm run validate-queries -- --language=typescript --language=javascript
```

### Direct execution

If you need to run the script directly:

```bash
# With ts-node (recommended for development)
npx ts-node scripts/validate-queries.ts

# After building the project (for production)
npm run build
npm run validate-queries:js
```

## Understanding the Output

The validation script generates:

1. **Console output**: Real-time validation results with pass/fail status
2. **Report file**: A detailed markdown report saved to `INDEXAUDIT/QUERY_VALIDATION_REPORT.md`

### Exit Codes

- `0`: All validations passed
- `1`: One or more validations failed or an error occurred

## Query File Structure

Query files are located in `src/services/tree-sitter/queries/` and follow this pattern:

```typescript
// Example: typescript.ts
export default `
;; Tree-sitter query syntax here
(function_declaration
  name: (identifier) @function.name)
`
```

### Supported Export Patterns

The validation system supports these export patterns:

1. **Template string export (preferred)**:

    ```typescript
    export default `your query here`
    ```

2. **String literal export**:

    ```typescript
    export default "your query here"
    ```

3. **Dynamic module loading** (requires ts-node):
    ```typescript
    const query = `your query here`
    export default query
    ```

## Troubleshooting

### Common Issues

1. **"Failed to load TypeScript query file"**

    - Ensure the query file exports a default template string
    - Run the script with ts-node: `npm run validate-queries`
    - Check that the query syntax is valid

2. **"Query file not found"**

    - Verify the query file exists in `src/services/tree-sitter/queries/`
    - Check the file name matches the language configuration in `scripts/validate-queries.ts`

3. **"WASM directory not found"**
    - Run `npm run setup-wasms-once` to download required WASM files
    - Verify the WASM files are in the correct location

### Validation Failures

When a query validation fails:

1. Check the detailed report for missing patterns
2. Examine the test fixtures in `test-fixtures/{language}/`
3. Update the query to match the expected syntax
4. Re-run the validation

## Development Workflow

1. **Make changes to a query file**
2. **Run validation**: `npm run validate-queries -- --language={your-language} --verbose`
3. **Review the output** and fix any issues
4. **Commit changes** once validation passes

## Adding New Language Support

To add support for a new language:

1. Create a query file in `src/services/tree-sitter/queries/{language}.ts`
2. Add test fixtures in `test-fixtures/{language}/`
3. Update the `LANGUAGES` array in `scripts/validate-queries.ts`
4. Run validation to ensure everything works

## Performance Considerations

- Validation can take time for large codebases
- Use `--language` flag to validate specific languages during development
- The `--verbose` flag provides detailed output but increases execution time

## Automated Integration

The validation script can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions step
- name: Validate Tree-sitter Queries
  run: npm run validate-queries
```

For production environments where TypeScript compilation is not available, ensure the project is built first and use the `validate-queries:js` script.
