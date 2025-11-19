# Phase 10, Task 2: TESTS / TESTED_BY Implementation Plan

**Status:** IN PROGRESS  
**Created:** 2025-01-19  
**Goal:** Implement generic test detection and relationship extraction for multiple languages and frameworks

---

## 🎯 Executive Summary

Build a **world-class, framework-agnostic test detection system** that works across:

- **10+ programming languages** (TypeScript, JavaScript, Python, Go, Rust, Java, C#, Ruby, PHP, Swift)
- **20+ test frameworks** (Jest, Vitest, Mocha, Pytest, Go testing, Rust cargo test, JUnit, NUnit, RSpec, PHPUnit, XCTest, etc.)
- **Multiple test types** (unit, integration, e2e, snapshot, performance)

This enables Roo Code to answer critical questions for ANY codebase:

- "Is this function tested?"
- "What tests cover this code?"
- "Show me the test for UserService"
- "What would break if I change this function?"

---

## 📊 Test Framework Coverage Matrix

### TypeScript / JavaScript

| Framework   | File Patterns                                                        | Detection Method                                     | Priority |
| ----------- | -------------------------------------------------------------------- | ---------------------------------------------------- | -------- |
| **Jest**    | `*.test.{js,ts,jsx,tsx}`, `*.spec.{js,ts,jsx,tsx}`, `__tests__/**/*` | Import from 'jest', `describe()`, `test()`, `it()`   | 🔥 HIGH  |
| **Vitest**  | `*.test.{js,ts,jsx,tsx}`, `*.spec.{js,ts,jsx,tsx}`                   | Import from 'vitest', `describe()`, `test()`, `it()` | 🔥 HIGH  |
| **Mocha**   | `*.test.{js,ts}`, `*.spec.{js,ts}`, `test/**/*`                      | Import from 'mocha', `describe()`, `it()`            | 🔥 HIGH  |
| **Jasmine** | `*.spec.{js,ts}`                                                     | Import from 'jasmine', `describe()`, `it()`          | MEDIUM   |
| **AVA**     | `*.test.{js,ts}`, `test.{js,ts}`                                     | Import from 'ava', `test()`                          | MEDIUM   |
| **Tape**    | `*.test.js`, `test.js`                                               | Import from 'tape', `test()`                         | LOW      |

### Python

| Framework    | File Patterns                             | Detection Method                                   | Priority |
| ------------ | ----------------------------------------- | -------------------------------------------------- | -------- |
| **Pytest**   | `test_*.py`, `*_test.py`, `tests/**/*.py` | Import pytest, `def test_*()`, `class Test*`       | 🔥 HIGH  |
| **Unittest** | `test_*.py`, `*_test.py`                  | Import unittest, `class *TestCase`, `def test_*()` | 🔥 HIGH  |
| **Nose2**    | `test_*.py`, `*_test.py`                  | Import nose2, `def test_*()`                       | MEDIUM   |
| **Doctest**  | `*.py` (with docstrings)                  | `>>>` in docstrings                                | LOW      |

### Go

| Framework      | File Patterns | Detection Method                              | Priority |
| -------------- | ------------- | --------------------------------------------- | -------- |
| **Go testing** | `*_test.go`   | `func Test*(t *testing.T)`, `func Benchmark*` | 🔥 HIGH  |
| **Testify**    | `*_test.go`   | Import testify, `suite.Suite`                 | MEDIUM   |
| **Ginkgo**     | `*_test.go`   | Import ginkgo, `Describe()`, `It()`           | MEDIUM   |

### Rust

| Framework      | File Patterns                           | Detection Method                 | Priority |
| -------------- | --------------------------------------- | -------------------------------- | -------- |
| **Cargo test** | `*.rs` with `#[test]` or `#[cfg(test)]` | `#[test]` attribute, `mod tests` | 🔥 HIGH  |

### Java

| Framework   | File Patterns                                     | Detection Method                          | Priority |
| ----------- | ------------------------------------------------- | ----------------------------------------- | -------- |
| **JUnit 5** | `*Test.java`, `*Tests.java`, `src/test/**/*.java` | `@Test`, `@ParameterizedTest` annotations | 🔥 HIGH  |
| **JUnit 4** | `*Test.java`, `src/test/**/*.java`                | `@Test` annotation                        | HIGH     |
| **TestNG**  | `*Test.java`, `src/test/**/*.java`                | `@Test` annotation from TestNG            | MEDIUM   |

### C# / .NET

| Framework  | File Patterns                            | Detection Method                         | Priority |
| ---------- | ---------------------------------------- | ---------------------------------------- | -------- |
| **NUnit**  | `*Tests.cs`, `*Test.cs`, `Tests/**/*.cs` | `[Test]`, `[TestFixture]` attributes     | 🔥 HIGH  |
| **xUnit**  | `*Tests.cs`, `*Test.cs`                  | `[Fact]`, `[Theory]` attributes          | 🔥 HIGH  |
| **MSTest** | `*Tests.cs`, `*Test.cs`                  | `[TestMethod]`, `[TestClass]` attributes | HIGH     |

### Ruby

| Framework    | File Patterns                            | Detection Method                             | Priority |
| ------------ | ---------------------------------------- | -------------------------------------------- | -------- |
| **RSpec**    | `*_spec.rb`, `spec/**/*_spec.rb`         | `describe`, `it`, `context`                  | 🔥 HIGH  |
| **Minitest** | `test_*.rb`, `*_test.rb`, `test/**/*.rb` | `class *Test < Minitest::Test`, `def test_*` | HIGH     |

### PHP

| Framework   | File Patterns                     | Detection Method                                          | Priority |
| ----------- | --------------------------------- | --------------------------------------------------------- | -------- |
| **PHPUnit** | `*Test.php`, `tests/**/*Test.php` | `class *Test extends TestCase`, `public function test*()` | 🔥 HIGH  |
| **Pest**    | `*.test.php`, `tests/**/*.php`    | `test()`, `it()`                                          | MEDIUM   |

### Swift

| Framework  | File Patterns                      | Detection Method                           | Priority |
| ---------- | ---------------------------------- | ------------------------------------------ | -------- |
| **XCTest** | `*Tests.swift`, `Tests/**/*.swift` | `class *Tests: XCTestCase`, `func test*()` | 🔥 HIGH  |

---

## 🏗️ Architecture Design

### 1. Test Detection Strategy (Multi-Layered)

```
Layer 1: File Path Pattern Matching
  ├─ Check file name against language-specific patterns
  ├─ Check directory structure (e.g., __tests__/, tests/, spec/)
  └─ Confidence: 70-80%

Layer 2: Import Statement Analysis
  ├─ Parse imports to detect test framework libraries
  ├─ Match against known test framework packages
  └─ Confidence: 85-95%

Layer 3: AST Content Analysis
  ├─ Look for test-specific function calls (describe, it, test)
  ├─ Look for test-specific decorators/attributes (@Test, #[test])
  ├─ Look for test class inheritance (extends TestCase)
  └─ Confidence: 95-100%

Layer 4: Test Type Inference
  ├─ Path-based: e2e/, integration/, unit/
  ├─ Name-based: *.e2e.test.ts, *.integration.spec.py
  └─ Confidence: 60-80%
```

### 2. Test Target Extraction Strategy

```
Strategy 1: Import Analysis (Highest Confidence)
  ├─ Extract all imports from test file
  ├─ Filter to source files (exclude test frameworks)
  ├─ Map imports to CodeBlocks in the index
  └─ Confidence: 90-95%

Strategy 2: Test Description Parsing (Medium Confidence)
  ├─ Extract strings from describe(), it(), test() calls
  ├─ Match against function/class names in codebase
  ├─ Use fuzzy matching for variations
  └─ Confidence: 60-75%

Strategy 3: Mock/Spy Analysis (Medium Confidence)
  ├─ Detect jest.mock(), vi.mock(), @patch decorators
  ├─ Extract mocked module paths
  ├─ Link to source files
  └─ Confidence: 70-85%

Strategy 4: File Name Correlation (Low Confidence)
  ├─ Match test file name to source file name
  ├─ user-service.test.ts → user-service.ts
  ├─ test_user_service.py → user_service.py
  └─ Confidence: 50-60%
```

---

## 📝 Implementation Steps

### Step 1: Extend CodeBlock Interface with Test Metadata

**File:** `src/services/code-index/interfaces/file-processor.ts`

Add comprehensive test metadata fields:

```typescript
export interface TestMetadata {
	/** Whether this block is a test */
	isTest: boolean

	/** Test framework detected (jest, vitest, pytest, go-testing, etc.) */
	testFramework?: string

	/** Test type inferred from path or naming (unit, integration, e2e, snapshot, benchmark) */
	testType?: "unit" | "integration" | "e2e" | "snapshot" | "benchmark" | "performance" | "unknown"

	/** Test targets: what this test is testing */
	testTargets?: TestTarget[]
}

export interface TestTarget {
	/** Target identifier (function/class name being tested) */
	targetIdentifier: string

	/** Target file path (if known) */
	targetFilePath?: string

	/** Confidence score (0-100) for this relationship */
	confidence: number

	/** How this target was detected */
	detectionMethod: "import" | "description" | "mock" | "filename" | "explicit"

	/** Line number where target is referenced in test */
	referenceLine?: number
}

export interface CodeBlock {
	// ... existing fields ...

	// Phase 10, Task 2: Test metadata (optional for backward compatibility)
	testMetadata?: TestMetadata
}
```

### Step 2: Implement Test Detection in CodeParser

**File:** `src/services/code-index/processors/parser.ts`

Add methods to detect test files and extract test metadata:

```typescript
/**
 * Detect if a file is a test file based on multiple signals
 */
private detectTestFile(filePath: string, tree: Parser.Tree, language: string): TestMetadata | undefined {
  const fileName = path.basename(filePath)
  const dirName = path.dirname(filePath)

  // Layer 1: File path pattern matching
  const pathScore = this.scoreTestFilePath(filePath, language)

  // Layer 2: Import analysis
  const importScore = this.scoreTestImports(tree, language)

  // Layer 3: AST content analysis
  const contentScore = this.scoreTestContent(tree, language)

  // Combine scores
  const totalScore = (pathScore * 0.3) + (importScore * 0.4) + (contentScore * 0.3)

  if (totalScore < 0.5) {
    return undefined // Not a test file
  }

  return {
    isTest: true,
    testFramework: this.detectTestFramework(tree, language),
    testType: this.inferTestType(filePath),
    testTargets: [] // Will be populated later
  }
}

/**
 * Score test file path patterns by language
 */
private scoreTestFilePath(filePath: string, language: string): number {
  const fileName = path.basename(filePath)
  const dirPath = path.dirname(filePath)

  // Language-specific patterns
  const patterns = this.getTestFilePatterns(language)

  for (const pattern of patterns) {
    if (pattern.test(fileName) || pattern.test(dirPath)) {
      return 0.8
    }
  }

  return 0.0
}

/**
 * Get test file patterns by language
 */
private getTestFilePatterns(language: string): RegExp[] {
  const patterns: Record<string, RegExp[]> = {
    typescript: [
      /\.test\.tsx?$/,
      /\.spec\.tsx?$/,
      /__tests__/,
      /\/tests?\//,
      /\/spec\//
    ],
    javascript: [
      /\.test\.jsx?$/,
      /\.spec\.jsx?$/,
      /__tests__/,
      /\/tests?\//,
      /\/spec\//
    ],
    python: [
      /^test_.*\.py$/,
      /.*_test\.py$/,
      /\/tests?\//,
      /\/test\//
    ],
    go: [
      /_test\.go$/
    ],
    rust: [
      // Rust tests are in same files with #[test] or #[cfg(test)]
      /\.rs$/ // Will need content analysis
    ],
    java: [
      /Test\.java$/,
      /Tests\.java$/,
      /\/test\//,
      /src\/test\//
    ],
    csharp: [
      /Tests?\.cs$/,
      /\/Tests?\//
    ],
    ruby: [
      /_spec\.rb$/,
      /^test_.*\.rb$/,
      /.*_test\.rb$/,
      /\/spec\//,
      /\/test\//
    ],
    php: [
      /Test\.php$/,
      /\.test\.php$/,
      /\/tests?\//
    ],
    swift: [
      /Tests\.swift$/,
      /\/Tests\//
    ]
  }

  return patterns[language] || []
}
```

### Step 3: Detect Test Framework from Imports and Content

```typescript
/**
 * Detect test framework from imports and AST content
 */
private detectTestFramework(tree: Parser.Tree, language: string): string | undefined {
  const rootNode = tree.rootNode

  // Extract import statements
  const imports = this.extractImportSources(rootNode)

  // Framework detection by language
  const frameworkMap: Record<string, Record<string, string>> = {
    typescript: {
      'vitest': 'vitest',
      'jest': 'jest',
      '@jest/globals': 'jest',
      'mocha': 'mocha',
      'jasmine': 'jasmine',
      'ava': 'ava',
      'tape': 'tape',
      '@testing-library': 'testing-library'
    },
    javascript: {
      'vitest': 'vitest',
      'jest': 'jest',
      'mocha': 'mocha',
      'jasmine': 'jasmine',
      'ava': 'ava',
      'tape': 'tape'
    },
    python: {
      'pytest': 'pytest',
      'unittest': 'unittest',
      'nose2': 'nose2',
      'nose': 'nose'
    },
    go: {
      'testing': 'go-testing',
      'github.com/stretchr/testify': 'testify',
      'github.com/onsi/ginkgo': 'ginkgo',
      'github.com/onsi/gomega': 'gomega'
    },
    java: {
      'org.junit.jupiter': 'junit5',
      'org.junit': 'junit4',
      'org.testng': 'testng'
    },
    csharp: {
      'NUnit.Framework': 'nunit',
      'Xunit': 'xunit',
      'Microsoft.VisualStudio.TestTools.UnitTesting': 'mstest'
    },
    ruby: {
      'rspec': 'rspec',
      'minitest': 'minitest'
    },
    php: {
      'PHPUnit': 'phpunit',
      'Pest': 'pest'
    },
    swift: {
      'XCTest': 'xctest'
    }
  }

  const languageFrameworks = frameworkMap[language] || {}

  for (const importSource of imports) {
    for (const [pattern, framework] of Object.entries(languageFrameworks)) {
      if (importSource.includes(pattern)) {
        return framework
      }
    }
  }

  // Fallback: detect from content patterns
  return this.detectFrameworkFromContent(rootNode, language)
}

/**
 * Extract import sources from AST
 */
private extractImportSources(node: Parser.SyntaxNode): string[] {
  const sources: string[] = []

  // Recursively find import nodes
  const findImports = (n: Parser.SyntaxNode) => {
    if (n.type === 'import_statement' || n.type === 'import_from_statement') {
      const sourceNode = n.childForFieldName('source')
      if (sourceNode) {
        sources.push(sourceNode.text.replace(/['"]/g, ''))
      }
    }

    for (const child of n.children) {
      findImports(child)
    }
  }

  findImports(node)
  return sources
}

/**
 * Infer test type from file path
 */
private inferTestType(filePath: string): TestMetadata['testType'] {
  const lowerPath = filePath.toLowerCase()

  if (lowerPath.includes('e2e') || lowerPath.includes('end-to-end')) {
    return 'e2e'
  }
  if (lowerPath.includes('integration') || lowerPath.includes('int.test')) {
    return 'integration'
  }
  if (lowerPath.includes('snapshot') || lowerPath.includes('.snap')) {
    return 'snapshot'
  }
  if (lowerPath.includes('benchmark') || lowerPath.includes('perf') || lowerPath.includes('performance')) {
    return 'benchmark'
  }
  if (lowerPath.includes('unit')) {
    return 'unit'
  }

  // Default to unit test if in test directory
  return 'unit'
}
```

### Step 4: Extract Test Targets from Test Files

```typescript
/**
 * Extract test targets from a test file
 */
private extractTestTargets(
  testBlock: CodeBlock,
  tree: Parser.Tree,
  allBlocks: CodeBlock[]
): TestTarget[] {
  const targets: TestTarget[] = []

  // Strategy 1: Import analysis (highest confidence)
  const importTargets = this.extractTargetsFromImports(testBlock, allBlocks)
  targets.push(...importTargets)

  // Strategy 2: Test description parsing
  const descriptionTargets = this.extractTargetsFromDescriptions(tree, allBlocks)
  targets.push(...descriptionTargets)

  // Strategy 3: Mock/spy analysis
  const mockTargets = this.extractTargetsFromMocks(tree, allBlocks)
  targets.push(...mockTargets)

  // Strategy 4: File name correlation
  const filenameTargets = this.extractTargetsFromFilename(testBlock, allBlocks)
  targets.push(...filenameTargets)

  // Deduplicate targets (keep highest confidence)
  return this.deduplicateTargets(targets)
}

/**
 * Extract targets from import statements
 */
private extractTargetsFromImports(
  testBlock: CodeBlock,
  allBlocks: CodeBlock[]
): TestTarget[] {
  const targets: TestTarget[] = []

  if (!testBlock.imports) {
    return targets
  }

  for (const importInfo of testBlock.imports) {
    // Skip test framework imports
    if (this.isTestFrameworkImport(importInfo.source)) {
      continue
    }

    // Find source file blocks
    const sourceBlocks = allBlocks.filter(block =>
      block.file_path.includes(importInfo.source) &&
      !block.testMetadata?.isTest
    )

    for (const sourceBlock of sourceBlocks) {
      // Check if imported symbols match block identifiers
      for (const symbol of importInfo.symbols) {
        if (sourceBlock.identifier === symbol) {
          targets.push({
            targetIdentifier: symbol,
            targetFilePath: sourceBlock.file_path,
            confidence: 90,
            detectionMethod: 'import',
            referenceLine: importInfo.line
          })
        }
      }
    }
  }

  return targets
}

/**
 * Extract targets from test descriptions (describe, it, test calls)
 */
private extractTargetsFromDescriptions(
  tree: Parser.Tree,
  allBlocks: CodeBlock[]
): TestTarget[] {
  const targets: TestTarget[] = []
  const rootNode = tree.rootNode

  // Find describe(), it(), test() calls
  const testCalls = this.findTestDescriptionCalls(rootNode)

  for (const call of testCalls) {
    // Extract string argument
    const description = call.description

    // Try to match against function/class names
    for (const block of allBlocks) {
      if (block.testMetadata?.isTest) continue

      // Exact match
      if (description.includes(block.identifier)) {
        targets.push({
          targetIdentifier: block.identifier,
          targetFilePath: block.file_path,
          confidence: 75,
          detectionMethod: 'description',
          referenceLine: call.line
        })
      }

      // Fuzzy match (e.g., "UserService" matches "user service")
      const normalizedDesc = description.toLowerCase().replace(/[^a-z0-9]/g, '')
      const normalizedId = block.identifier.toLowerCase().replace(/[^a-z0-9]/g, '')

      if (normalizedDesc.includes(normalizedId) || normalizedId.includes(normalizedDesc)) {
        targets.push({
          targetIdentifier: block.identifier,
          targetFilePath: block.file_path,
          confidence: 60,
          detectionMethod: 'description',
          referenceLine: call.line
        })
      }
    }
  }

  return targets
}

/**
 * Find test description calls (describe, it, test)
 */
private findTestDescriptionCalls(node: Parser.SyntaxNode): Array<{description: string, line: number}> {
  const calls: Array<{description: string, line: number}> = []

  const traverse = (n: Parser.SyntaxNode) => {
    if (n.type === 'call_expression') {
      const callee = n.childForFieldName('function')
      if (callee && ['describe', 'it', 'test', 'context'].includes(callee.text)) {
        const args = n.childForFieldName('arguments')
        if (args && args.childCount > 0) {
          const firstArg = args.child(0)
          if (firstArg && firstArg.type === 'string') {
            calls.push({
              description: firstArg.text.replace(/['"]/g, ''),
              line: firstArg.startPosition.row + 1
            })
          }
        }
      }
    }

    for (const child of n.children) {
      traverse(child)
    }
  }

  traverse(node)
  return calls
}

/**
 * Extract targets from mock/spy calls
 */
private extractTargetsFromMocks(
  tree: Parser.Tree,
  allBlocks: CodeBlock[]
): TestTarget[] {
  const targets: TestTarget[] = []
  const rootNode = tree.rootNode

  // Find jest.mock(), vi.mock(), @patch() calls
  const mockCalls = this.findMockCalls(rootNode)

  for (const mock of mockCalls) {
    // Find blocks in the mocked file
    const sourceBlocks = allBlocks.filter(block =>
      block.file_path.includes(mock.modulePath) &&
      !block.testMetadata?.isTest
    )

    for (const block of sourceBlocks) {
      targets.push({
        targetIdentifier: block.identifier,
        targetFilePath: block.file_path,
        confidence: 80,
        detectionMethod: 'mock',
        referenceLine: mock.line
      })
    }
  }

  return targets
}

/**
 * Extract targets from filename correlation
 */
private extractTargetsFromFilename(
  testBlock: CodeBlock,
  allBlocks: CodeBlock[]
): TestTarget[] {
  const targets: TestTarget[] = []
  const testFileName = path.basename(testBlock.file_path)

  // Remove test suffixes/prefixes
  const sourceFileName = testFileName
    .replace(/\.test\.(ts|js|tsx|jsx|py|go|rs|java|cs|rb|php|swift)$/, '.$1')
    .replace(/\.spec\.(ts|js|tsx|jsx|py|go|rs|java|cs|rb|php|swift)$/, '.$1')
    .replace(/^test_/, '')
    .replace(/_test\.(py|go|rb)$/, '.$1')
    .replace(/Test\.(java|cs|swift)$/, '.$1')
    .replace(/_spec\.rb$/, '.rb')

  // Find matching source files
  for (const block of allBlocks) {
    if (block.testMetadata?.isTest) continue

    const blockFileName = path.basename(block.file_path)

    if (blockFileName === sourceFileName) {
      targets.push({
        targetIdentifier: block.identifier,
        targetFilePath: block.file_path,
        confidence: 55,
        detectionMethod: 'filename'
      })
    }
  }

  return targets
}

/**
 * Deduplicate targets, keeping highest confidence
 */
private deduplicateTargets(targets: TestTarget[]): TestTarget[] {
  const map = new Map<string, TestTarget>()

  for (const target of targets) {
    const key = `${target.targetFilePath}:${target.targetIdentifier}`
    const existing = map.get(key)

    if (!existing || target.confidence > existing.confidence) {
      map.set(key, target)
    }
  }

  return Array.from(map.values())
}
```

### Step 5: Create TESTS Relationships in GraphIndexer

**File:** `src/services/code-index/graph/graph-indexer.ts`

Add test relationship creation logic:

```typescript
/**
 * Extract TESTS relationships from test metadata
 */
private extractTestRelationships(
  block: CodeBlock,
  allBlocks: CodeBlock[]
): CodeRelationship[] {
  const relationships: CodeRelationship[] = []

  // Only process test blocks
  if (!block.testMetadata?.isTest || !block.testMetadata.testTargets) {
    return relationships
  }

  const fromId = this.generateNodeId(block)

  for (const target of block.testMetadata.testTargets) {
    // Find the target block
    const targetBlock = allBlocks.find(b =>
      b.file_path === target.targetFilePath &&
      b.identifier === target.targetIdentifier
    )

    if (targetBlock) {
      const toId = this.generateNodeId(targetBlock)

      // Create TESTS relationship
      relationships.push({
        fromId,
        toId,
        type: 'TESTS',
        metadata: {
          confidence: target.confidence,
          detectionMethod: target.detectionMethod,
          testFramework: block.testMetadata.testFramework,
          testType: block.testMetadata.testType,
          referenceLine: target.referenceLine
        }
      })
    }
  }

  return relationships
}

/**
 * Integrate test relationship extraction into main extractRelationships method
 */
extractRelationships(block: CodeBlock, allBlocks: CodeBlock[]): CodeRelationship[] {
  const relationships: CodeRelationship[] = []

  // ... existing relationship extraction (IMPORTS, CALLS, etc.) ...

  // Phase 10, Task 2: Extract TESTS relationships
  const testRelationships = this.extractTestRelationships(block, allBlocks)
  relationships.push(...testRelationships)

  // Create bidirectional TESTED_BY relationships
  const testsRelationships = relationships.filter(r => r.type === 'TESTS')
  for (const testsRel of testsRelationships) {
    relationships.push({
      fromId: testsRel.toId,
      toId: testsRel.fromId,
      type: 'TESTED_BY',
      metadata: testsRel.metadata
    })
  }

  return relationships
}
```

### Step 6: Update Neo4j Service Interface

**File:** `src/services/code-index/interfaces/neo4j-service.ts`

Add TESTS/TESTED_BY to relationship types:

```typescript
export interface CodeRelationship {
	fromId: string
	toId: string
	type:
		| "CALLS"
		| "CALLED_BY"
		| "TESTS" // Phase 10, Task 2: Test relationships
		| "TESTED_BY" // Phase 10, Task 2: Reverse test relationships
		| "IMPORTS"
		| "EXTENDS"
		| "IMPLEMENTS"
		| "CONTAINS"
		| "DEFINES"
		| "USES"
	metadata?: Record<string, unknown>
}
```

---

## 🧪 Testing Strategy

### Unit Tests

Create `src/services/code-index/__tests__/test-detection.spec.ts`:

```typescript
describe("Test Detection", () => {
	it("should detect Jest test files", () => {
		const result = detectTestFile("user.test.ts", tree, "typescript")
		expect(result?.isTest).toBe(true)
		expect(result?.testFramework).toBe("jest")
	})

	it("should detect Pytest test files", () => {
		const result = detectTestFile("test_user.py", tree, "python")
		expect(result?.isTest).toBe(true)
		expect(result?.testFramework).toBe("pytest")
	})

	it("should detect Go test files", () => {
		const result = detectTestFile("user_test.go", tree, "go")
		expect(result?.isTest).toBe(true)
		expect(result?.testFramework).toBe("go-testing")
	})

	it("should infer test type from path", () => {
		expect(inferTestType("src/__tests__/e2e/user.test.ts")).toBe("e2e")
		expect(inferTestType("tests/integration/api.spec.ts")).toBe("integration")
		expect(inferTestType("tests/unit/utils.test.ts")).toBe("unit")
	})
})

describe("Test Target Extraction", () => {
	it("should extract targets from imports", () => {
		const targets = extractTargetsFromImports(testBlock, allBlocks)
		expect(targets).toHaveLength(2)
		expect(targets[0].detectionMethod).toBe("import")
		expect(targets[0].confidence).toBeGreaterThan(85)
	})

	it("should extract targets from test descriptions", () => {
		const targets = extractTargetsFromDescriptions(tree, allBlocks)
		expect(targets.some((t) => t.targetIdentifier === "UserService")).toBe(true)
	})

	it("should extract targets from mocks", () => {
		const targets = extractTargetsFromMocks(tree, allBlocks)
		expect(targets[0].detectionMethod).toBe("mock")
	})
})
```

### Integration Tests

Validate with THIS codebase's actual test files:

```typescript
describe("Integration: Roo-Code-Knowledge Tests", () => {
	it("should detect Vitest tests in src/__tests__/", async () => {
		const testFiles = await scanDirectory("src/__tests__/")
		const detectedTests = testFiles.filter((f) => f.testMetadata?.isTest)

		expect(detectedTests.length).toBeGreaterThan(0)
		expect(detectedTests.every((t) => t.testMetadata?.testFramework === "vitest")).toBe(true)
	})

	it("should link integration-search.spec.ts to SearchOrchestrator", async () => {
		const testFile = await parseFile("src/services/code-index/__tests__/integration-search.spec.ts")
		const targets = testFile.testMetadata?.testTargets || []

		expect(targets.some((t) => t.targetIdentifier === "SearchOrchestrator")).toBe(true)
		expect(targets.some((t) => t.targetIdentifier === "CodeIndexManager")).toBe(true)
	})
})
```

---

## ✅ Success Criteria

### Functional Requirements

- ✅ Detect test files across 10+ languages
- ✅ Support 20+ test frameworks
- ✅ Extract test targets with confidence scores
- ✅ Create bidirectional TESTS/TESTED_BY relationships
- ✅ Store comprehensive metadata (framework, type, confidence)

### Quality Requirements

- ✅ All TypeScript type checks pass
- ✅ All ESLint checks pass
- ✅ Backward compatible (testMetadata is optional)
- ✅ No performance degradation during indexing

### Validation Requirements

- ✅ Works with THIS codebase (Vitest tests)
- ✅ Can answer "is this function tested?"
- ✅ Can answer "what tests cover this code?"
- ✅ Confidence scores are accurate (>85% for imports, >60% for descriptions)

---

## 📊 Expected Impact

### Before (Current State)

- ❌ Cannot identify test files
- ❌ Cannot link tests to source code
- ❌ Cannot answer "is this tested?"
- ❌ No test coverage visibility

### After (Phase 10, Task 2 Complete)

- ✅ Detects test files across 10+ languages
- ✅ Links tests to source code with confidence scores
- ✅ Can answer "is this function tested?" with evidence
- ✅ Can answer "what tests cover this code?" with specific test names
- ✅ Enables test coverage analysis
- ✅ Enables impact analysis ("what tests will break if I change this?")

### Progress Toward World-Class

- **Before:** 50% complete (after Phase 10, Task 1)
- **After:** ~58% complete (estimated)
- **Gap Closed:** +8% toward world-class status

---

## 🚀 Implementation Timeline

| Step      | Task                                          | Estimated Time  | Complexity |
| --------- | --------------------------------------------- | --------------- | ---------- |
| 1         | Extend CodeBlock interface                    | 30 min          | Low        |
| 2         | Implement test detection (10 languages)       | 3-4 hours       | High       |
| 3         | Implement framework detection (20 frameworks) | 2-3 hours       | Medium     |
| 4         | Implement test target extraction              | 3-4 hours       | High       |
| 5         | Create TESTS relationships in GraphIndexer    | 1-2 hours       | Medium     |
| 6         | Update Neo4j service interface                | 15 min          | Low        |
| 7         | Testing and validation                        | 2-3 hours       | Medium     |
| 8         | Commit and push                               | 15 min          | Low        |
| **Total** | **Full implementation**                       | **12-17 hours** | **High**   |

---

## 🎯 Next Steps After Completion

1. **Phase 10, Task 3:** Type system relationships (HAS_TYPE, ACCEPTS_TYPE, RETURNS_TYPE)
2. **Phase 10, Task 4:** Inheritance relationships (EXTENDS, EXTENDED_BY, IMPLEMENTS, IMPLEMENTED_BY)
3. **Phase 10, Task 5:** Data flow relationships (ACCESSES, MODIFIES)
4. **Phase 11:** Impact analysis queries
5. **Phase 12:** Enhanced context for AI agent
6. **Phase 13:** Quality metrics dashboard

---

## 📚 References

- **Vitest Docs:** https://vitest.dev/config/
- **Jest Docs:** https://jestjs.io/docs/configuration
- **Pytest Docs:** https://docs.pytest.org/en/stable/
- **Go Testing:** https://pkg.go.dev/testing
- **Rust Testing:** https://doc.rust-lang.org/book/ch11-00-testing.html
- **JUnit 5:** https://junit.org/junit5/docs/current/user-guide/
- **Tree-sitter Queries:** https://tree-sitter.github.io/tree-sitter/using-parsers#pattern-matching-with-queries

---

**END OF IMPLEMENTATION PLAN**
