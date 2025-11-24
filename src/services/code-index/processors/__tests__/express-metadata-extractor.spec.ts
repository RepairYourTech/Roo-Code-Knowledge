import { Node } from "web-tree-sitter"
import {
	extractExpressRouteMetadata,
	extractExpressMiddlewareMetadata,
	extractExpressServerMetadata,
	extractExpressApplicationMetadata,
	extractExpressComponentMetadata,
	ExpressRouteMetadata,
	ExpressMiddlewareMetadata,
	ExpressServerMetadata,
	ExpressApplicationMetadata,
	ExpressComponentMetadata,
} from "../metadata-extractor"

// Mock tree-sitter node for testing
function createMockNode(type: string, text: string, children?: Node[]): Node {
	const node = {
		type,
		text,
		children: children || [],
		childForFieldName: (name: string) => {
			// Simple mock implementation
			return null
		},
		startPosition: { row: 0, column: 0 },
		endPosition: { row: 0, column: 0 },
	} as Node

	// Note: We can't set parent property as it's read-only in the actual Node interface

	return node
}

describe("Express.js Metadata Extractor", () => {
	describe("extractExpressRouteMetadata", () => {
		it("should extract metadata for a simple GET route", () => {
			const routeText = "app.get('/users', (req, res) => { res.json([]) })"
			const node = createMockNode("call_expression", routeText)

			const metadata = extractExpressRouteMetadata(node, "")

			expect(metadata).toBeDefined()
			expect(metadata?.routeType).toBe("app")
			expect(metadata?.httpMethod).toBe("GET")
			expect(metadata?.routePath).toBe("/users")
			expect(metadata?.isAsync).toBe(false)
			expect(metadata?.handlerType).toBe("arrow")
		})

		it("should extract metadata for a POST route with middleware", () => {
			const routeText =
				"app.post('/users', auth, validateUser, async (req, res) => { const user = await createUser(req.body); res.status(201).json(user) })"
			const node = createMockNode("call_expression", routeText)

			const metadata = extractExpressRouteMetadata(node, "")

			expect(metadata).toBeDefined()
			expect(metadata?.routeType).toBe("app")
			expect(metadata?.httpMethod).toBe("POST")
			expect(metadata?.routePath).toBe("/users")
			expect(metadata?.isAsync).toBe(true)
			expect(metadata?.handlerType).toBe("arrow")
			expect(metadata?.middleware).toContain("auth")
			expect(metadata?.middleware).toContain("validateUser")
		})

		it("should extract metadata for a router route with parameters", () => {
			const routeText = "router.get('/users/:id', getUserById)"
			const node = createMockNode("call_expression", routeText)

			const metadata = extractExpressRouteMetadata(node, "")

			expect(metadata).toBeDefined()
			expect(metadata?.routeType).toBe("router")
			expect(metadata?.httpMethod).toBe("GET")
			expect(metadata?.routePath).toBe("/users/:id")
			expect(metadata?.parameters).toContain("id")
			expect(metadata?.handlerType).toBe("identifier")
			expect(metadata?.handlerName).toBe("getUserById")
		})

		it("should extract metadata for a route with multiple parameters", () => {
			const routeText = "app.get('/users/:userId/posts/:postId', (req, res) => { /* ... */ })"
			const node = createMockNode("call_expression", routeText)

			const metadata = extractExpressRouteMetadata(node, "")

			expect(metadata).toBeDefined()
			expect(metadata?.routeType).toBe("app")
			expect(metadata?.httpMethod).toBe("GET")
			expect(metadata?.routePath).toBe("/users/:userId/posts/:postId")
			expect(metadata?.parameters).toContain("userId")
			expect(metadata?.parameters).toContain("postId")
		})
	})

	describe("extractExpressMiddlewareMetadata", () => {
		it("should extract metadata for application middleware", () => {
			const middlewareText = "app.use(cors())"
			const node = createMockNode("call_expression", middlewareText)

			const metadata = extractExpressMiddlewareMetadata(node, "")

			expect(metadata).toBeDefined()
			expect(metadata?.middlewareType).toBe("builtin")
			expect(metadata?.handlerType).toBe("function")
		})

		it("should extract metadata for router middleware", () => {
			const middlewareText = "router.use(authMiddleware)"
			const node = createMockNode("call_expression", middlewareText)

			const metadata = extractExpressMiddlewareMetadata(node, "")

			expect(metadata).toBeDefined()
			expect(metadata?.middlewareType).toBe("router")
			expect(metadata?.middlewareName).toBe("authMiddleware")
		})

		it("should extract metadata for error handling middleware", () => {
			const middlewareText =
				"app.use((err, req, res, next) => { console.error(err); res.status(500).send('Server error') })"
			const node = createMockNode("call_expression", middlewareText)

			const metadata = extractExpressMiddlewareMetadata(node, "")

			expect(metadata).toBeDefined()
			expect(metadata?.middlewareType).toBe("application")
			expect(metadata?.isErrorHandling).toBe(true)
			expect(metadata?.parameters).toContain("err")
			expect(metadata?.parameters).toContain("req")
			expect(metadata?.parameters).toContain("res")
			expect(metadata?.parameters).toContain("next")
		})

		it("should extract metadata for path-specific middleware", () => {
			const middlewareText = "app.use('/api', apiMiddleware)"
			const node = createMockNode("call_expression", middlewareText)

			const metadata = extractExpressMiddlewareMetadata(node, "")

			expect(metadata).toBeDefined()
			expect(metadata?.middlewareType).toBe("application")
			expect(metadata?.middlewarePath).toBe("/api")
			expect(metadata?.middlewareName).toBe("apiMiddleware")
		})
	})

	describe("extractExpressServerMetadata", () => {
		it("should extract metadata for a basic Express server", () => {
			const serverText = "const app = express(); app.listen(3000)"
			const node = createMockNode("call_expression", serverText)

			const metadata = extractExpressServerMetadata(node, "")

			expect(metadata).toBeDefined()
			expect(metadata?.serverType).toBe("app")
			expect(metadata?.port).toBe(3000)
		})

		it("should extract metadata for a server with port and host", () => {
			const serverText = "app.listen(3000, 'localhost')"
			const node = createMockNode("call_expression", serverText)

			const metadata = extractExpressServerMetadata(node, "")

			expect(metadata).toBeDefined()
			expect(metadata?.serverType).toBe("app")
			expect(metadata?.port).toBe(3000)
			expect(metadata?.host).toBe("localhost")
		})

		it("should extract metadata for a server with environment-based port", () => {
			const serverText = "app.listen(process.env.PORT || 3000)"
			const node = createMockNode("call_expression", serverText)

			const metadata = extractExpressServerMetadata(node, "")

			expect(metadata).toBeDefined()
			expect(metadata?.serverType).toBe("app")
			expect(metadata?.port).toBe("process.env.PORT || 3000")
		})

		it("should extract metadata for a server with callback", () => {
			const serverText = "app.listen(3000, () => { console.log('Server started') })"
			const node = createMockNode("call_expression", serverText)

			const metadata = extractExpressServerMetadata(node, "")

			expect(metadata).toBeDefined()
			expect(metadata?.serverType).toBe("app")
			expect(metadata?.port).toBe(3000)
			expect(metadata?.callbackName).toBe("callback")
		})

		it("should extract metadata for a server with static files", () => {
			const serverText = "const app = express(); app.use(express.static('public')); app.listen(3000)"
			const node = createMockNode("call_expression", serverText)

			const metadata = extractExpressServerMetadata(node, "")

			expect(metadata).toBeDefined()
			expect(metadata?.serverType).toBe("app")
			expect(metadata?.port).toBe(3000)
			expect(metadata?.hasStaticFiles).toBe(true)
			expect(metadata?.staticPaths).toContain("public")
		})
	})

	describe("extractExpressApplicationMetadata", () => {
		it("should extract metadata for a basic Express app", () => {
			const appText = `
				const express = require('express');
				const app = express();
				app.use(express.json());
				app.use(cors());
				app.get('/', (req, res) => res.send('Hello World'));
				app.listen(3000);
			`
			const node = createMockNode("program", appText)

			const metadata = extractExpressApplicationMetadata(node, appText)

			expect(metadata).toBeDefined()
			expect(metadata?.applicationType).toBe("app")
			expect(metadata?.hasCors).toBe(true)
			expect(metadata?.hasBodyParser).toBe(true)
			expect(metadata?.imports).toContain("express")
			expect(metadata?.routes).toContain("/")
		})

		it("should extract metadata for an Express router", () => {
			const routerText = `
				const express = require('express');
				const router = express.Router();
				router.get('/users', (req, res) => { /* ... */ });
				router.post('/users', (req, res) => { /* ... */ });
				module.exports = router;
			`
			const node = createMockNode("program", routerText)

			const metadata = extractExpressApplicationMetadata(node, routerText)

			expect(metadata).toBeDefined()
			expect(metadata?.applicationType).toBe("router")
			expect(metadata?.imports).toContain("express")
			expect(metadata?.routes).toContain("/users")
		})

		it("should extract metadata for an app with authentication", () => {
			const appText = `
				const express = require('express');
				const passport = require('passport');
				const jwt = require('jsonwebtoken');
				const app = express();
				app.use(passport.initialize());
				app.use('/api', authMiddleware);
			`
			const node = createMockNode("program", appText)

			const metadata = extractExpressApplicationMetadata(node, appText)

			expect(metadata).toBeDefined()
			expect(metadata?.applicationType).toBe("app")
			expect(metadata?.hasAuth).toBe(true)
			expect(metadata?.imports).toContain("passport")
			expect(metadata?.imports).toContain("jsonwebtoken")
			expect(metadata?.middleware).toContain("authMiddleware")
		})
	})

	describe("extractExpressComponentMetadata", () => {
		it("should extract metadata for a route handler", () => {
			const handlerText = "app.get('/users', (req, res) => { res.json(req.params.id) })"
			const node = createMockNode("call_expression", handlerText)

			const metadata = extractExpressComponentMetadata(node, handlerText)

			expect(metadata).toBeDefined()
			expect(metadata?.componentType).toBe("route_handler")
			expect(metadata?.hasRequestParams).toBe(true)
			expect(metadata?.hasResponseBody).toBe(true)
			expect(metadata?.responseType).toBe("json")
		})

		it("should extract metadata for a middleware function", () => {
			const middlewareText =
				"app.use((req, res, next) => { req.user = getUserFromToken(req.headers.authorization); next() })"
			const node = createMockNode("call_expression", middlewareText)

			const metadata = extractExpressComponentMetadata(node, middlewareText)

			expect(metadata).toBeDefined()
			expect(metadata?.componentType).toBe("middleware")
		})

		it("should extract metadata for an exported route handler", () => {
			const handlerText = "module.exports = (req, res) => { res.send('Hello') }"
			const node = createMockNode("assignment_expression", handlerText)

			const metadata = extractExpressComponentMetadata(node, handlerText)

			expect(metadata).toBeDefined()
			expect(metadata?.isExported).toBe(true)
		})

		it("should extract metadata for a handler with query parameters", () => {
			const handlerText = "app.get('/search', (req, res) => { const { q, limit } = req.query; /* ... */ })"
			const node = createMockNode("call_expression", handlerText)

			const metadata = extractExpressComponentMetadata(node, handlerText)

			expect(metadata).toBeDefined()
			expect(metadata?.componentType).toBe("route_handler")
			expect(metadata?.hasQueryParams).toBe(true)
		})

		it("should extract metadata for a handler with different response types", () => {
			const handlerText = "app.get('/download', (req, res) => { res.download('/path/to/file.pdf') })"
			const node = createMockNode("call_expression", handlerText)

			const metadata = extractExpressComponentMetadata(node, handlerText)

			expect(metadata).toBeDefined()
			expect(metadata?.componentType).toBe("route_handler")
			expect(metadata?.responseType).toBe("download")
		})
	})
})
