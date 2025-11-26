import { Parser, Query, Language } from "web-tree-sitter"
import { initializeTreeSitter } from "./helpers"

describe("Express.js Tree-sitter Patterns", () => {
	let parser: Parser
	let typescriptLanguage: Language
	let javascriptLanguage: Language
	let expressRoutesQuery: Query
	let expressMiddlewareQuery: Query
	let expressErrorHandlersQuery: Query
	let expressServersQuery: Query
	let expressStaticQuery: Query
	let expressRoutersQuery: Query

	beforeAll(async () => {
		// Initialize tree-sitter
		await initializeTreeSitter()
		parser = new Parser()

		// Load actual TypeScript and JavaScript language objects
		typescriptLanguage = await Language.load("tree-sitter-typescript.wasm")
		javascriptLanguage = await Language.load("tree-sitter-javascript.wasm")

		// Create queries for Express.js patterns
		expressRoutesQuery = new Query(
			typescriptLanguage,
			`
			(call_expression
			  function: (member_expression
			    object: (identifier) @app
			    property: (property_identifier) @method
			    (#match? @method "^(get|post|put|delete|patch|head|options|all)$"))
			  arguments: (arguments
			    (string) @path
			    [(arrow_function) (function_expression) (identifier)] @handler))
		`,
		)

		expressMiddlewareQuery = new Query(
			typescriptLanguage,
			`
			(call_expression
			  function: (member_expression
			    object: (identifier) @app
			    property: (property_identifier) @method
			    (#eq? @method "use"))
			  arguments: (arguments
			    [(string) @path
			     (identifier) @handler
			     (member_expression) @handler
			     (arrow_function) @handler
			     (function_expression) @handler]))
		`,
		)

		expressErrorHandlersQuery = new Query(
			typescriptLanguage,
			`
			(call_expression
			  function: (member_expression
			    object: (identifier) @app
			    property: (property_identifier) @method
			    (#eq? @method "use"))
			  arguments: (arguments
			    (arrow_function) @handler
			    (function_expression) @handler)
			  (#match? @handler "err.*req.*res.*next"))
		`,
		)

		expressServersQuery = new Query(
			typescriptLanguage,
			`
			(call_expression
			  function: (member_expression
			    object: (identifier) @app
			    property: (property_identifier) @method
			    (#eq? @method "listen"))
			  arguments: (arguments
			    [(number) (string) (identifier)] @port
			    [(identifier) (arrow_function) (function_expression)]? @callback))
		`,
		)

		expressStaticQuery = new Query(
			typescriptLanguage,
			`
			(call_expression
			  function: (member_expression
			    object: (identifier) @express
			    (#eq? @express "express")
			    property: (property_identifier) @method
			    (#eq? @method "static"))
			  arguments: (arguments
			    (string) @path))
		`,
		)

		expressRoutersQuery = new Query(
			typescriptLanguage,
			`
			(call_expression
			  function: (identifier) @function
			  (#eq? @function "Router")
			  arguments: (arguments)?)
		`,
		)
	})

	describe("TypeScript Express.js Patterns", () => {
		beforeAll(() => {
			parser.setLanguage(typescriptLanguage)
		})

		it("should match Express.js app.get() route", () => {
			const code = `
				import express from 'express';
				const app = express();
				
				app.get('/users', (req, res) => {
					res.json([]);
				});
			`

			const tree = parser.parse(code)
			const matches = expressRoutesQuery?.matches(tree!.rootNode) || []

			expect(matches.length).toBeGreaterThan(0)
		})

		it("should match Express.js router.post() route with middleware", () => {
			const code = `
				import { Router } from 'express';
				const router = Router();
				
				router.post('/users', auth, validateUser, (req, res) => {
					// Create user logic
				});
			`

			const tree = parser.parse(code)
			const matches = expressRoutesQuery?.matches(tree!.rootNode) || []

			expect(matches.length).toBeGreaterThan(0)
		})

		it("should match Express.js app.use() middleware", () => {
			const code = `
				import express from 'express';
				import cors from 'cors';
				const app = express();
				
				app.use(cors());
				app.use(express.json());
			`

			const tree = parser.parse(code)
			const matches = expressMiddlewareQuery?.matches(tree!.rootNode) || []

			expect(matches.length).toBeGreaterThan(0)
		})

		it("should match Express.js error handling middleware", () => {
			const code = `
				import express from 'express';
				const app = express();
				
				app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
					console.error(err);
					res.status(500).send('Internal Server Error');
				});
			`

			const tree = parser.parse(code)
			const matches = expressErrorHandlersQuery?.matches(tree!.rootNode) || []

			expect(matches.length).toBeGreaterThan(0)
		})

		it("should match Express.js server creation", () => {
			const code = `
				import express from 'express';
				
				const app = express();
				const port = process.env.PORT || 3000;
				
				app.listen(port, () => {
					console.log("Server running on port " + port);
				});
			`

			const tree = parser.parse(code)
			const matches = expressServersQuery?.matches(tree!.rootNode) || []

			expect(matches.length).toBeGreaterThan(0)
		})

		it("should match Express.js static file serving", () => {
			const code = `
				import express from 'express';
				import path from 'path';
				const app = express();
				
				app.use(express.static(path.join(__dirname, 'public')));
				app.use('/static', express.static('assets'));
			`

			const tree = parser.parse(code)
			const matches = expressStaticQuery?.matches(tree!.rootNode) || []

			expect(matches.length).toBeGreaterThan(0)
		})

		it("should match Express.js router creation", () => {
			const code = `
				import { Router } from 'express';
				
				const userRouter = Router();
				const adminRouter = Router();
				
				export { userRouter, adminRouter };
			`

			const tree = parser.parse(code)
			const matches = expressRoutersQuery?.matches(tree!.rootNode) || []

			expect(matches.length).toBeGreaterThan(0)
		})

		it("should match Express.js route handlers with async/await", () => {
			const code = `
				import express from 'express';
				const app = express();
				
				app.get('/users/:id', async (req, res) => {
					try {
						const user = await getUserById(req.params.id);
						res.json(user);
					} catch (error) {
						res.status(500).json({ error: 'Failed to fetch user' });
					}
				});
			`

			const tree = parser.parse(code)
			const matches = expressRoutesQuery?.matches(tree!.rootNode) || []

			expect(matches.length).toBeGreaterThan(0)
		})
	})

	describe("JavaScript Express.js Patterns", () => {
		beforeAll(() => {
			parser.setLanguage(javascriptLanguage)
		})

		it("should match Express.js require() and app.get() route", () => {
			const code = `
				const express = require('express');
				const app = express();
				
				app.get('/users', (req, res) => {
					res.json([]);
				});
			`

			const tree = parser.parse(code)
			const matches = expressRoutesQuery?.matches(tree!.rootNode) || []

			expect(matches.length).toBeGreaterThan(0)
		})

		it("should match Express.js router.post() route with middleware", () => {
			const code = `
				const { Router } = require('express');
				const router = Router();
				
				router.post('/users', auth, validateUser, (req, res) => {
					// Create user logic
				});
			`

			const tree = parser.parse(code)
			const matches = expressRoutesQuery?.matches(tree!.rootNode) || []

			expect(matches.length).toBeGreaterThan(0)
		})

		it("should match Express.js app.use() middleware", () => {
			const code = `
				const express = require('express');
				const cors = require('cors');
				const app = express();
				
				app.use(cors());
				app.use(express.json());
			`

			const tree = parser.parse(code)
			const matches = expressMiddlewareQuery?.matches(tree!.rootNode) || []

			expect(matches.length).toBeGreaterThan(0)
		})

		it("should match Express.js error handling middleware", () => {
			const code = `
				const express = require('express');
				const app = express();
				
				app.use((err, req, res, next) => {
					console.error(err);
					res.status(500).send('Internal Server Error');
				});
			`

			const tree = parser.parse(code)
			const matches = expressErrorHandlersQuery?.matches(tree!.rootNode) || []

			expect(matches.length).toBeGreaterThan(0)
		})

		it("should match Express.js server creation", () => {
			const code = `
				const express = require('express');
				
				const app = express();
				const port = process.env.PORT || 3000;
				
				app.listen(port, () => {
					console.log("Server running on port " + port);
				});
			`

			const tree = parser.parse(code)
			const matches = expressServersQuery?.matches(tree!.rootNode) || []

			expect(matches.length).toBeGreaterThan(0)
		})

		it("should match Express.js static file serving", () => {
			const code = `
				const express = require('express');
				const path = require('path');
				const app = express();
				
				app.use(express.static(path.join(__dirname, 'public')));
				app.use('/static', express.static('assets'));
			`

			const tree = parser.parse(code)
			const matches = expressStaticQuery?.matches(tree!.rootNode) || []

			expect(matches.length).toBeGreaterThan(0)
		})

		it("should match Express.js router creation", () => {
			const code = `
				const { Router } = require('express');
				
				const userRouter = Router();
				const adminRouter = Router();
				
				module.exports = { userRouter, adminRouter };
			`

			const tree = parser.parse(code)
			const matches = expressRoutersQuery?.matches(tree!.rootNode) || []

			expect(matches.length).toBeGreaterThan(0)
		})

		it("should match Express.js route handlers with async/await", () => {
			const code = `
				const express = require('express');
				const app = express();
				
				app.get('/users/:id', async (req, res) => {
					try {
						const user = await getUserById(req.params.id);
						res.json(user);
					} catch (error) {
						res.status(500).json({ error: 'Failed to fetch user' });
					}
				});
			`

			const tree = parser.parse(code)
			const matches = expressRoutesQuery?.matches(tree!.rootNode) || []

			expect(matches.length).toBeGreaterThan(0)
		})
	})

	describe("Express.js Route Parameter Extraction", () => {
		it("should extract parameters from TypeScript routes", () => {
			const code = `
				import express from 'express';
				const app = express();
				
				app.get('/users/:userId/posts/:postId', (req, res) => {
					const { userId, postId } = req.params;
					// Logic here
				});
			`

			const tree = parser.parse(code)
			const matches = expressRoutesQuery?.matches(tree!.rootNode) || []

			expect(matches.length).toBeGreaterThan(0)

			// Check if route path contains parameters
			const pathCapture = matches[0].captures.find((c) => c.name === "path")
			if (pathCapture) {
				expect(pathCapture.node.text).toContain(":userId")
				expect(pathCapture.node.text).toContain(":postId")
			}
		})

		it("should extract parameters from JavaScript routes", () => {
			const code = `
				const express = require('express');
				const app = express();
				
				app.get('/users/:userId/posts/:postId', (req, res) => {
					const { userId, postId } = req.params;
					// Logic here
				});
			`

			const tree = parser.parse(code)
			const matches = expressRoutesQuery?.matches(tree!.rootNode) || []

			expect(matches.length).toBeGreaterThan(0)

			// Check if route path contains parameters
			const pathCapture = matches[0].captures.find((c) => c.name === "path")
			if (pathCapture) {
				expect(pathCapture.node.text).toContain(":userId")
				expect(pathCapture.node.text).toContain(":postId")
			}
		})
	})

	describe("Express.js Middleware Chain Detection", () => {
		it("should detect middleware chains in TypeScript", () => {
			const code = `
				import express from 'express';
				const app = express();
				
				app.use('/api', auth, rateLimit, validateRequest, (req, res, next) => {
					// Handler logic
				});
			`

			const tree = parser.parse(code)
			const matches = expressMiddlewareQuery?.matches(tree!.rootNode) || []

			expect(matches.length).toBeGreaterThan(0)

			// Check if middleware chain is detected
			const middlewareText = matches[0].captures[0].node.text
			expect(middlewareText).toContain("auth")
			expect(middlewareText).toContain("rateLimit")
			expect(middlewareText).toContain("validateRequest")
		})

		it("should detect middleware chains in JavaScript", () => {
			const code = `
				const express = require('express');
				const app = express();
				
				app.use('/api', auth, rateLimit, validateRequest, (req, res, next) => {
					// Handler logic
				});
			`

			const tree = parser.parse(code)
			const matches = expressMiddlewareQuery?.matches(tree!.rootNode) || []

			expect(matches.length).toBeGreaterThan(0)

			// Check if middleware chain is detected
			const middlewareText = matches[0].captures[0].node.text
			expect(middlewareText).toContain("auth")
			expect(middlewareText).toContain("rateLimit")
			expect(middlewareText).toContain("validateRequest")
		})
	})
})
