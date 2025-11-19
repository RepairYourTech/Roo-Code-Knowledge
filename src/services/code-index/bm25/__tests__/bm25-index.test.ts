import { BM25IndexService } from "../bm25-index"
import { BM25Document } from "../../interfaces/bm25-index"

describe("BM25IndexService", () => {
	let bm25Index: BM25IndexService

	beforeEach(() => {
		bm25Index = new BM25IndexService()
	})

	describe("addDocument", () => {
		it("should add a document to the index", () => {
			const doc: BM25Document = {
				id: "doc1",
				text: "function parseMetadata() { return metadata }",
				filePath: "/src/parser.ts",
				startLine: 1,
				endLine: 3,
			}

			bm25Index.addDocument(doc)

			expect(bm25Index.isEmpty()).toBe(false)
			expect(bm25Index.getStats().documentCount).toBe(1)
		})

		it("should add multiple documents", () => {
			const docs: BM25Document[] = [
				{
					id: "doc1",
					text: "class UserManager { constructor() {} }",
					filePath: "/src/user.ts",
					startLine: 1,
					endLine: 3,
				},
				{
					id: "doc2",
					text: "function authenticate(user: User) { return true }",
					filePath: "/src/auth.ts",
					startLine: 5,
					endLine: 7,
				},
			]

			bm25Index.addDocuments(docs)

			expect(bm25Index.getStats().documentCount).toBe(2)
		})
	})

	describe("search", () => {
		beforeEach(() => {
			const docs: BM25Document[] = [
				{
					id: "doc1",
					text: "function parseMetadata(file: string) { const metadata = extractMetadata(file); return metadata; }",
					filePath: "/src/parser.ts",
					startLine: 1,
					endLine: 5,
				},
				{
					id: "doc2",
					text: "class UserManager { authenticate(user: User) { return validateUser(user); } }",
					filePath: "/src/user.ts",
					startLine: 10,
					endLine: 15,
				},
				{
					id: "doc3",
					text: "export function validateUser(user: User): boolean { return user.isValid; }",
					filePath: "/src/validation.ts",
					startLine: 20,
					endLine: 22,
				},
			]

			bm25Index.addDocuments(docs)
		})

		it("should find exact function name matches", () => {
			const results = bm25Index.search("parseMetadata")

			expect(results.length).toBeGreaterThan(0)
			expect(results[0].id).toBe("doc1")
			expect(results[0].score).toBeGreaterThan(0)
		})

		it("should find class name matches", () => {
			const results = bm25Index.search("UserManager")

			expect(results.length).toBeGreaterThan(0)
			expect(results[0].id).toBe("doc2")
		})

		it("should rank by relevance", () => {
			const results = bm25Index.search("user")

			// Both doc2 and doc3 contain "user", but doc3 has it more prominently
			expect(results.length).toBeGreaterThan(0)
			expect(results[0].score).toBeGreaterThan(0)
		})

		it("should return empty array for no matches", () => {
			const results = bm25Index.search("nonexistentfunction")

			expect(results).toEqual([])
		})

		it("should respect limit parameter", () => {
			const results = bm25Index.search("user", 1)

			expect(results.length).toBeLessThanOrEqual(1)
		})

		it("should handle empty query", () => {
			const results = bm25Index.search("")

			expect(results).toEqual([])
		})
	})

	describe("removeDocument", () => {
		it("should remove a document by ID", () => {
			const doc: BM25Document = {
				id: "doc1",
				text: "function test() {}",
				filePath: "/src/test.ts",
				startLine: 1,
				endLine: 1,
			}

			bm25Index.addDocument(doc)
			expect(bm25Index.getStats().documentCount).toBe(1)

			bm25Index.removeDocument("doc1")
			expect(bm25Index.isEmpty()).toBe(true)
		})
	})

	describe("removeDocumentsByFilePath", () => {
		it("should remove all documents for a file", () => {
			const docs: BM25Document[] = [
				{
					id: "doc1",
					text: "function a() {}",
					filePath: "/src/file1.ts",
					startLine: 1,
					endLine: 1,
				},
				{
					id: "doc2",
					text: "function b() {}",
					filePath: "/src/file1.ts",
					startLine: 3,
					endLine: 3,
				},
				{
					id: "doc3",
					text: "function c() {}",
					filePath: "/src/file2.ts",
					startLine: 1,
					endLine: 1,
				},
			]

			bm25Index.addDocuments(docs)
			expect(bm25Index.getStats().documentCount).toBe(3)

			bm25Index.removeDocumentsByFilePath("/src/file1.ts")
			expect(bm25Index.getStats().documentCount).toBe(1)
		})
	})

	describe("clear", () => {
		it("should clear all documents", () => {
			const docs: BM25Document[] = [
				{
					id: "doc1",
					text: "test",
					filePath: "/test.ts",
					startLine: 1,
					endLine: 1,
				},
			]

			bm25Index.addDocuments(docs)
			expect(bm25Index.isEmpty()).toBe(false)

			bm25Index.clear()
			expect(bm25Index.isEmpty()).toBe(true)
		})
	})
})
