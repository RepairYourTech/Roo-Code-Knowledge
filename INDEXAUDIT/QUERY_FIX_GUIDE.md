# Tree-sitter Query Fix Guide

## Introduction

This guide addresses the "zero captures" issue where tree-sitter queries fail to match code structures, causing the indexing pipeline to resort to fallback chunking. This results in poor code navigation and missing relationships in the knowledge graph.

## Understanding Tree-sitter Queries

Tree-sitter queries use S-expressions to match patterns in the Abstract Syntax Tree (AST). A mismatch between the query pattern and the actual AST produced by the parser leads to zero captures.

Common causes:

1. **Node Type Mismatch**: Query expects `function_definition` but parser produces `function_declaration`.
2. **Structure Mismatch**: Query expects direct child relationship `(class_def (function_def))` but AST has intermediate nodes.
3. **Missing Fields**: Query uses field names `name: (identifier)` that don't exist in the grammar.

## Diagnostic Tools

### Validation Script

Run the validation script to check all languages against test fixtures:

```bash
npm run validate-queries
```

This will generate a report in `INDEXAUDIT/QUERY_VALIDATION_REPORT.md`.

### AST Introspection

The validation script uses `src/services/tree-sitter/ast-introspection.ts` to analyze the actual AST structure. You can use this to see what node types are actually present in your code.

## Fixing Query Issues

1. **Identify the Failure**: Run the validation script and check which languages/files are failing.
2. **Analyze the AST**: Look at the report to see what node types are found in the failing files.
3. **Update the Query**: Modify `src/services/tree-sitter/queries/{language}.ts` to match the actual node types.
    - If the query expects `function_item` but the AST has `function_definition`, update the query.
    - Use the `query-fallback-strategy.ts` to see simplified patterns that are known to work.
4. **Verify**: Run the validation script again to ensure the fix works and doesn't regress other patterns.

## Progressive Fallback Strategy

We have implemented a tiered fallback strategy in `src/services/tree-sitter/query-fallback-strategy.ts`:

1. **Tier 1 (Comprehensive)**: The full, detailed query.
2. **Tier 2 (Simplified)**: Basic definitions only (functions, classes).
3. **Tier 3 (Emergency)**: Identifiers and strings (always produces something).

If you are editing the comprehensive query, ensure it is at least as capable as the simplified query.

## Language-Specific Tips

### TypeScript/JavaScript

- Watch out for `function_declaration` vs `function_definition`.
- `arrow_function` is distinct from other function types.
- JSX elements have their own node types.

### Python

- `function_definition` is the standard for functions.
- Decorators wrap definitions, changing the hierarchy.

### Rust

- `function_item` is used for functions.
- `impl_item` contains methods.

### Java

- `method_declaration` is used for methods.
- Annotations can complicate the tree structure.

### Go

- `function_declaration` and `method_declaration` are distinct.

### C++

- `function_definition` vs `declaration`.
- Template syntax adds complexity.

## Adding Test Fixtures

Add new representative code samples to `test-fixtures/{language}/` to ensure your use cases are covered.
