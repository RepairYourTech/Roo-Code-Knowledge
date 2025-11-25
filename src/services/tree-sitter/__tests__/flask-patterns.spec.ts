import { describe, it, expect } from "vitest"
import {
	extractFlaskRouteMetadata,
	extractFlaskViewMetadata,
	extractFlaskRequestMetadata,
	extractFlaskResponseMetadata,
} from "../../code-index/processors/metadata-extractor"
import { Node } from "web-tree-sitter"

// Mock Node class for testing
class MockNode {
	type: string
	text: string
	children: (Node | null)[] = []
	parent?: Node | null

	constructor(type: string, text: string, children?: (Node | null)[]) {
		this.type = type
		this.text = text
		if (children) {
			this.children = children
			children.forEach((child) => {
				if (child && "parent" in child) {
					;(child as any).parent = this
				}
			})
		}
	}

	childForFieldName(name: string): Node | null {
		// Simplified implementation for testing
		return null
	}
}

describe("Flask Pattern Extraction", () => {
	describe("Flask Route Detection", () => {
		it("should detect basic GET route", () => {
			const code = `
@app.route('/users')
def get_users():
	return jsonify({'users': []})
`

			const node = new MockNode("decorated_definition", code)
			const metadata = extractFlaskRouteMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.routePath).toBe("/users")
			expect(metadata?.httpMethod).toBe("GET")
			expect(metadata?.functionName).toBe("get_users")
		})

		it("should detect POST route", () => {
			const code = `
@app.route('/users', methods=['POST'])
def create_user():
	return jsonify({'message': 'User created'})
`

			const node = new MockNode("decorated_definition", code)
			const metadata = extractFlaskRouteMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.routePath).toBe("/users")
			expect(metadata?.httpMethod).toBe("POST")
			expect(metadata?.methods).toContain("POST")
		})

		it("should detect route with parameters", () => {
			const code = `
@app.route('/users/<int:user_id>')
def get_user(user_id):
	user = User.query.get(user_id)
	return jsonify({'user': user})
`

			const node = new MockNode("decorated_definition", code)
			const metadata = extractFlaskRouteMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.routePath).toBe("/users/<int:user_id>")
			expect(metadata?.httpMethod).toBe("GET")
		})

		it("should detect route with multiple methods", () => {
			const code = `
@app.route('/users/<int:user_id>', methods=['GET', 'PUT', 'DELETE'])
def handle_user(user_id):
	if request.method == 'GET':
		return get_user(user_id)
	elif request.method == 'PUT':
		return update_user(user_id)
	elif request.method == 'DELETE':
		return delete_user(user_id)
`

			const node = new MockNode("decorated_definition", code)
			const metadata = extractFlaskRouteMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.routePath).toBe("/users/<int:user_id>")
			expect(metadata?.methods).toEqual(expect.arrayContaining(["GET", "PUT", "DELETE"]))
		})

		it("should detect async route", () => {
			const code = `
@app.route('/users')
async def get_users():
	users = await get_users_async()
	return jsonify({'users': users})
`

			const node = new MockNode("decorated_definition", code)
			const metadata = extractFlaskRouteMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.isAsync).toBe(true)
		})
	})

	describe("Flask View Detection", () => {
		it("should detect function-based view", () => {
			const code = `
@app.route('/users')
def get_users():
	return jsonify({'users': []})
`

			const node = new MockNode("decorated_definition", code)
			const metadata = extractFlaskViewMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.viewType).toBe("function")
			expect(metadata?.functionName).toBe("get_users")
		})

		it("should detect view with template rendering", () => {
			const code = `
from flask import render_template

@app.route('/profile/<username>')
def user_profile(username):
	user = User.query.filter_by(username=username).first()
	return render_template('users/profile.html', user=user)
`

			const node = new MockNode("decorated_definition", code)
			const metadata = extractFlaskViewMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.viewType).toBe("function")
			expect(metadata?.templatePath).toBe("users/profile.html")
			expect(metadata?.responseType).toBe("render_template")
		})

		it("should detect view with JSON response", () => {
			const code = `
from flask import jsonify

@app.route('/api/users')
def api_users():
	users = User.query.all()
	return jsonify([user.to_dict() for user in users])
`

			const node = new MockNode("decorated_definition", code)
			const metadata = extractFlaskViewMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.viewType).toBe("function")
			expect(metadata?.responseType).toBe("jsonify")
		})

		it("should detect view with form handling", () => {
			const code = `
from flask import request, redirect, url_for

@app.route('/users', methods=['POST'])
def create_user():
	username = request.form.get('username')
	email = request.form.get('email')
	
	user = User(username=username, email=email)
	db.session.add(user)
	db.session.commit()
	
	return redirect(url_for('get_users'))
`

			const node = new MockNode("decorated_definition", code)
			const metadata = extractFlaskViewMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.viewType).toBe("function")
			expect(metadata?.formHandling).toBe(true)
			expect(metadata?.requestAccess).toContain("form")
		})

		it("should detect view with query parameters", () => {
			const code = `
from flask import request

@app.route('/search')
def search():
	query = request.args.get('q', '')
	page = request.args.get('page', 1, type=int)
	results = search_products(query, page)
	return jsonify({'results': results})
`

			const node = new MockNode("decorated_definition", code)
			const metadata = extractFlaskViewMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.viewType).toBe("function")
			expect(metadata?.requestAccess).toContain("args")
		})

		it("should detect view with file uploads", () => {
			const code = `
from flask import request

@app.route('/upload', methods=['POST'])
def upload_file():
	if 'file' not in request.files:
		return 'No file part', 400
	file = request.files['file']
	if file.filename == '':
		return 'No selected file', 400
	if file:
		filename = secure_filename(file.filename)
		file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
		return 'File uploaded successfully'
`

			const node = new MockNode("decorated_definition", code)
			const metadata = extractFlaskViewMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.viewType).toBe("function")
			expect(metadata?.requestAccess).toContain("files")
		})
	})

	describe("Flask Request Detection", () => {
		it("should detect form data access", () => {
			const code = `
from flask import request

@app.route('/login', methods=['POST'])
def login():
	username = request.form.get('username')
	password = request.form.get('password')
	# Login logic here
`

			const node = new MockNode("decorated_definition", code)
			const metadata = extractFlaskRequestMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.requestType).toBe("form")
		})

		it("should detect query parameters access", () => {
			const code = `
from flask import request

@app.route('/search')
def search():
	query = request.args.get('q')
	page = int(request.args.get('page', 1))
	# Search logic here
`

			const node = new MockNode("decorated_definition", code)
			const metadata = extractFlaskRequestMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.requestType).toBe("args")
		})

		it("should detect JSON data access", () => {
			const code = `
from flask import request

@app.route('/api/users', methods=['POST'])
def create_user():
	data = request.get_json()
	username = data.get('username')
	email = data.get('email')
	# Create user logic here
`

			const node = new MockNode("decorated_definition", code)
			const metadata = extractFlaskRequestMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.requestType).toBe("json")
		})

		it("should detect file upload access", () => {
			const code = `
from flask import request

@app.route('/upload', methods=['POST'])
def upload_file():
	file = request.files.get('file')
	if file and file.filename:
		# Process file
		return 'File uploaded'
`

			const node = new MockNode("decorated_definition", code)
			const metadata = extractFlaskRequestMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.requestType).toBe("files")
		})
	})

	describe("Flask Response Detection", () => {
		it("should detect template rendering", () => {
			const code = `
from flask import render_template

@app.route('/profile/<username>')
def user_profile(username):
	user = User.query.filter_by(username=username).first()
	return render_template('profile.html', user=user)
`

			const node = new MockNode("decorated_definition", code)
			const metadata = extractFlaskResponseMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.responseType).toBe("render_template")
			expect(metadata?.templatePath).toBe("profile.html")
		})

		it("should detect JSON response", () => {
			const code = `
from flask import jsonify

@app.route('/api/users')
def get_users():
	users = User.query.all()
	return jsonify([user.to_dict() for user in users])
`

			const node = new MockNode("decorated_definition", code)
			const metadata = extractFlaskResponseMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.responseType).toBe("jsonify")
		})

		it("should detect redirect response", () => {
			const code = `
from flask import redirect, url_for

@app.route('/old-path')
def old_path():
	return redirect(url_for('new_path'))
`

			const node = new MockNode("decorated_definition", code)
			const metadata = extractFlaskResponseMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.responseType).toBe("redirect")
		})

		it("should detect string response", () => {
			const code = `
@app.route('/ping')
def ping():
	return 'pong'
`

			const node = new MockNode("decorated_definition", code)
			const metadata = extractFlaskResponseMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.responseType).toBe("string")
		})

		it("should detect file response", () => {
			const code = `
from flask import send_file

@app.route('/download/<filename>')
def download_file(filename):
	return send_file(os.path.join(app.config['UPLOAD_FOLDER'], filename))
`

			const node = new MockNode("decorated_definition", code)
			const metadata = extractFlaskResponseMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.responseType).toBe("file")
		})

		it("should detect response with status code", () => {
			const code = `
@app.route('/not-found')
def not_found():
	return 'Not Found', 404
`

			const node = new MockNode("decorated_definition", code)
			const metadata = extractFlaskResponseMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.statusCode).toBe(404)
		})
	})

	describe("Complex Flask Patterns", () => {
		it("should detect complete Flask application", () => {
			const appCode = `
from flask import Flask, render_template, request, jsonify, redirect, url_for
from flask_wtf.csrf import CSRFProtect

app = Flask(__name__)
csrf = CSRFProtect(app)

@app.route('/')
def index():
	return render_template('index.html')

@app.route('/api/users', methods=['GET', 'POST'])
def handle_users():
	if request.method == 'GET':
		users = User.query.all()
		return jsonify([user.to_dict() for user in users])
	else:
		data = request.get_json()
		user = User(username=data['username'], email=data['email'])
		db.session.add(user)
		db.session.commit()
		return jsonify({'message': 'User created', 'user': user.to_dict()}), 201

@app.route('/users/<int:user_id>')
def get_user(user_id):
	user = User.query.get_or_404(user_id)
	return jsonify(user.to_dict())

@app.route('/upload', methods=['POST'])
def upload_file():
	if 'file' not in request.files:
		return jsonify({'error': 'No file part'}), 400
	file = request.files['file']
	if file.filename == '':
		return jsonify({'error': 'No selected file'}), 400
	if file:
		filename = secure_filename(file.filename)
		file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
		return jsonify({'message': 'File uploaded successfully', 'filename': filename})
`

			// Test index route
			const indexNode = new MockNode(
				"decorated_definition",
				appCode.split("@app.route")[1].split("@app.route")[0],
			)
			const indexMetadata = extractFlaskViewMetadata(indexNode as Node, appCode)

			expect(indexMetadata).toBeDefined()
			expect(indexMetadata?.responseType).toBe("render_template")

			// Test API route with multiple methods
			const apiNode = new MockNode("decorated_definition", appCode.split("@app.route")[2].split("@app.route")[0])
			const apiMetadata = extractFlaskViewMetadata(apiNode as Node, appCode)

			expect(apiMetadata).toBeDefined()
			expect(apiMetadata?.requestAccess).toContain("json")

			// Test file upload route
			const uploadNode = new MockNode("decorated_definition", appCode.split("@app.route")[4])
			const uploadMetadata = extractFlaskViewMetadata(uploadNode as Node, appCode)

			expect(uploadMetadata).toBeDefined()
			expect(uploadMetadata?.requestAccess).toContain("files")
		})
	})
})
