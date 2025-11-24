// npx vitest services/tree-sitter/__tests__/yamlQuery.spec.ts

import * as path from "path"
import { Parser, Query } from "web-tree-sitter"
import { loadRequiredLanguageParsers } from "../languageParser"
import yamlQuery from "../queries/yaml"

// Path to the directory containing WASM files.
const WASM_DIR = path.join(__dirname, "../../../node_modules/tree-sitter-wasms/out")

describe("YAML Query - General Config Pattern", () => {
	let parser: Parser
	let query: Query

	beforeAll(async () => {
		const parsers = await loadRequiredLanguageParsers(["test.yaml"], WASM_DIR)
		expect(parsers.yaml).toBeDefined()
		expect(parsers.yaml.query).toBeDefined()
		parser = parsers.yaml.parser
		query = parsers.yaml.query
	})

	describe("Document wrapper restriction", () => {
		it("should only match top-level block_mapping_pair nodes", () => {
			// Sample YAML content with nested mappings
			const yamlContent = `
# Top level config
top_level_key: top_level_value
nested_config:
  nested_key: nested_value
  deeply_nested:
    very_deep_key: very_deep_value
another_top: another_value
`

			const tree = parser.parse(yamlContent)
			const captures = query.captures(tree.rootNode)

			// Filter for general_config captures
			const generalConfigCaptures = captures.filter((capture) => capture.name === "definition.general_config")

			// Should only capture top-level mappings, not nested ones
			expect(generalConfigCaptures.length).toBe(3) // top_level_key, nested_config, another_top

			// Verify the captured keys are actually top-level
			const capturedKeys = generalConfigCaptures
				.map((capture) => {
					const keyNode = capture.node.childForFieldName("key")
					return keyNode ? keyNode.text : ""
				})
				.filter((text) => text.length > 0)

			expect(capturedKeys).toContain("top_level_key")
			expect(capturedKeys).toContain("nested_config")
			expect(capturedKeys).toContain("another_top")

			// Should NOT contain deeply nested keys
			expect(capturedKeys).not.toContain("nested_key")
			expect(capturedKeys).not.toContain("very_deep_key")
		})

		it("should handle single document with multiple top-level mappings", () => {
			const yamlContent = `
service: web
database:
  host: localhost
  port: 5432
cache:
  enabled: true
  ttl: 300
`

			const tree = parser.parse(yamlContent)
			const captures = query.captures(tree.rootNode)
			const generalConfigCaptures = captures.filter((capture) => capture.name === "definition.general_config")

			// Should capture all 3 top-level mappings
			expect(generalConfigCaptures.length).toBe(3)

			const capturedKeys = generalConfigCaptures
				.map((capture) => {
					const keyNode = capture.node.childForFieldName("key")
					return keyNode ? keyNode.text : ""
				})
				.filter((text) => text.length > 0)

			expect(capturedKeys).toContain("service")
			expect(capturedKeys).toContain("database")
			expect(capturedKeys).toContain("cache")
		})

		it("should not match anything in non-document contexts", () => {
			// This test verifies the document wrapper is working
			// by creating content that would match block_mapping_pair
			// but is not at document level
			const yamlContent = `
top_level:
  nested_level:
    deep_level: value
`

			const tree = parser.parse(yamlContent)
			const captures = query.captures(tree.rootNode)
			const generalConfigCaptures = captures.filter((capture) => capture.name === "definition.general_config")

			// Should only capture top_level, not nested_level or deep_level
			expect(generalConfigCaptures.length).toBe(1)

			const capturedKeys = generalConfigCaptures
				.map((capture) => {
					const keyNode = capture.node.childForFieldName("key")
					return keyNode ? keyNode.text : ""
				})
				.filter((text) => text.length > 0)

			expect(capturedKeys).toContain("top_level")
			expect(capturedKeys).not.toContain("nested_level")
			expect(capturedKeys).not.toContain("deep_level")
		})

		it("should handle empty YAML gracefully", () => {
			const yamlContent = ""
			const tree = parser.parse(yamlContent)
			const captures = query.captures(tree.rootNode)
			const generalConfigCaptures = captures.filter((capture) => capture.name === "definition.general_config")

			expect(generalConfigCaptures.length).toBe(0)
		})

		it("should handle YAML with only comments", () => {
			const yamlContent = `
# This is a comment
# Another comment
`
			const tree = parser.parse(yamlContent)
			const captures = query.captures(tree.rootNode)
			const generalConfigCaptures = captures.filter((capture) => capture.name === "definition.general_config")

			expect(generalConfigCaptures.length).toBe(0)
		})

		it("should handle YAML with arrays and scalars", () => {
			const yamlContent = `
string_value: "just a string"
number_value: 42
boolean_value: true
array_value:
  - item1
  - item2
  - item3
`

			const tree = parser.parse(yamlContent)
			const captures = query.captures(tree.rootNode)
			const generalConfigCaptures = captures.filter((capture) => capture.name === "definition.general_config")

			// Should capture all 4 top-level mappings
			expect(generalConfigCaptures.length).toBe(4)

			const capturedKeys = generalConfigCaptures
				.map((capture) => {
					const keyNode = capture.node.childForFieldName("key")
					return keyNode ? keyNode.text : ""
				})
				.filter((text) => text.length > 0)

			expect(capturedKeys).toContain("string_value")
			expect(capturedKeys).toContain("number_value")
			expect(capturedKeys).toContain("boolean_value")
			expect(capturedKeys).toContain("array_value")
		})
	})

	describe("Performance comparison", () => {
		it("should demonstrate performance improvement with large nested YAML", () => {
			// Create a large YAML file with many nested mappings
			let largeYaml = "top_level: value\n"
			for (let i = 0; i < 100; i++) {
				largeYaml += `section_${i}:\n`
				for (let j = 0; j < 50; j++) {
					largeYaml += `  nested_${j}: value_${i}_${j}\n`
				}
			}

			const tree = parser.parse(largeYaml)

			// Test with document wrapper (current implementation)
			const startTime = performance.now()
			const captures = query.captures(tree.rootNode)
			const generalConfigCaptures = captures.filter((capture) => capture.name === "definition.general_config")
			const endTime = performance.now()

			// Should only capture 101 top-level mappings (1 + 100 sections)
			expect(generalConfigCaptures.length).toBe(101)

			// Performance should be reasonable (less than 100ms for this test)
			const executionTime = endTime - startTime
			expect(executionTime).toBeLessThan(100)

			console.log(
				`Document wrapper query executed in ${executionTime.toFixed(2)}ms for ${largeYaml.split("\n").length} lines`,
			)
		})
	})

	describe("Query syntax validation", () => {
		it("should have valid tree-sitter query syntax", () => {
			// The query should be valid tree-sitter syntax
			expect(() => new Query(parser.getLanguage(), yamlQuery)).not.toThrow()
		})

		it("should have proper capture structure", () => {
			const yamlContent = `
test_key: test_value
`
			const tree = parser.parse(yamlContent)
			const captures = query.captures(tree.rootNode)
			const generalConfigCaptures = captures.filter((capture) => capture.name === "definition.general_config")

			expect(generalConfigCaptures.length).toBe(1)

			const capture = generalConfigCaptures[0]

			// Should have the expected capture name
			expect(capture.name).toBe("definition.general_config")

			// Should capture both key and value
			expect(capture.node.childForFieldName("key")).toBeDefined()
			expect(capture.node.childForFieldName("value")).toBeDefined()
		})
	})
})
