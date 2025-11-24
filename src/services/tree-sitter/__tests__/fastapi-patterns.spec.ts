import { describe, it, expect } from "vitest"
import {
	extractFastAPIRouteMetadata,
	extractFastAPIDependencyMetadata,
	extractFastAPIApplicationMetadata,
	extractFastAPIPydanticModelMetadata,
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

describe("FastAPI Pattern Extraction", () => {
	describe("FastAPI Route Detection", () => {
		it("should detect basic GET route", () => {
			const code = `
@app.get("/users")
async def get_users():
	return {"users": []}
`

			const node = new MockNode("decorated_definition", code)
			const metadata = extractFastAPIRouteMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.routeType).toBe("app")
			expect(metadata?.httpMethod).toBe("GET")
			expect(metadata?.routePath).toBe("/users")
			expect(metadata?.isAsync).toBe(true)
			expect(metadata?.handlerType).toBe("async_function")
		})

		it("should detect POST route with parameters", () => {
			const code = `
@app.post("/users/{user_id}")
async def create_user(user_id: int, user: UserSchema):
	return {"user_id": user_id}
`

			const node = new MockNode("decorated_definition", code)
			const metadata = extractFastAPIRouteMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.routeType).toBe("app")
			expect(metadata?.httpMethod).toBe("POST")
			expect(metadata?.routePath).toBe("/users/{user_id}")
			expect(metadata?.isAsync).toBe(true)
		})

		it("should detect router route", () => {
			const code = `
@router.get("/products/{product_id}")
async def get_product(product_id: int):
	return {"product_id": product_id}
`

			const node = new MockNode("decorated_definition", code)
			const metadata = extractFastAPIRouteMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.routeType).toBe("router")
			expect(metadata?.httpMethod).toBe("GET")
			expect(metadata?.routePath).toBe("/products/{product_id}")
		})

		it("should detect route with dependencies", () => {
			const code = `
@app.get("/protected")
async def protected_route(current_user: User = Depends(get_current_user)):
	return {"user": current_user}
`

			const node = new MockNode("decorated_definition", code)
			const metadata = extractFastAPIRouteMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.dependencies).toContain("get_current_user")
		})

		it("should detect route with response model", () => {
			const code = `
@app.get("/users", response_model=List[UserSchema])
async def get_users():
	return []
`

			const node = new MockNode("decorated_definition", code)
			const metadata = extractFastAPIRouteMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.responseModel).toBe("List")
		})

		it("should detect CRUD endpoint type", () => {
			const code = `
@app.delete("/users/{user_id}")
async def delete_user(user_id: int):
	return {"deleted": True}
`

			const node = new MockNode("decorated_definition", code)
			const metadata = extractFastAPIRouteMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.endpointType).toBe("crud")
		})

		it("should detect auth endpoint type", () => {
			const code = `
@app.post("/auth/login")
async def login(username: str, password: str):
	return {"access_token": "token"}
`

			const node = new MockNode("decorated_definition", code)
			const metadata = extractFastAPIRouteMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.endpointType).toBe("auth")
		})
	})

	describe("FastAPI Parameter Detection", () => {
		it("should detect Path parameter", () => {
			const code = `
@app.get("/items/{item_id}")
async def get_item(item_id: int = Path(...)):
	return {"item_id": item_id}
`

			const node = new MockNode("decorated_definition", code)
			const metadata = extractFastAPIRouteMetadata(node as unknown as Node, code)

			expect(metadata?.parameters).toBeDefined()
			expect(metadata?.parameters?.some((p) => p.name === "item_id" && p.type === "Path")).toBe(true)
		})

		it("should detect Query parameter", () => {
			const code = `
@app.get("/items/")
async def get_items(skip: int = Query(0), limit: int = Query(100)):
	return {"skip": skip, "limit": limit}
`

			const node = new MockNode("decorated_definition", code)
			const metadata = extractFastAPIRouteMetadata(node as unknown as Node, code)

			expect(metadata?.parameters).toBeDefined()
			expect(metadata?.parameters?.some((p) => p.name === "skip" && p.type === "Query")).toBe(true)
			expect(metadata?.parameters?.some((p) => p.name === "limit" && p.type === "Query")).toBe(true)
		})

		it("should detect parameter validation", () => {
			const code = `
@app.get("/items/")
async def get_items(q: str = Query(None, min_length=3, max_length=50)):
	return {"q": q}
`

			const node = new MockNode("decorated_definition", code)
			const metadata = extractFastAPIRouteMetadata(node as unknown as Node, code)

			expect(metadata?.parameters).toBeDefined()
			const qParam = metadata?.parameters?.find((p) => p.name === "q")
			expect(qParam?.validation?.minLength).toBe(3)
			expect(qParam?.validation?.maxLength).toBe(50)
		})
	})

	describe("FastAPI Dependency Injection", () => {
		it("should detect Depends dependency", () => {
			const code = `
def get_db():
	db = SessionLocal()
	try:
		yield db
	finally:
		db.close()

@app.get("/users/")
async def get_users(db: Session = Depends(get_db)):
	return db.query(User).all()
`

			const node = new MockNode("decorated_definition", code)
			const metadata = extractFastAPIDependencyMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.type).toBe("Depends")
		})

		it("should detect Annotated dependency", () => {
			const code = `
from typing import Annotated

@app.get("/users/")
async def get_users(current_user: Annotated[User, Depends(get_current_user)]):
	return {"user": current_user}
`

			const node = new MockNode("decorated_definition", code)
			const metadata = extractFastAPIDependencyMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.type).toBe("Annotated")
		})

		it("should detect class dependency", () => {
			const code = `
class UserService:
	def __init__(self, db: Session):
		self.db = db

@app.get("/users/")
async def get_users(user_service: UserService = Depends(UserService)):
	return user_service.get_all()
`

			const node = new MockNode("decorated_definition", code)
			const metadata = extractFastAPIDependencyMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.type).toBe("class")
		})
	})

	describe("FastAPI Application Detection", () => {
		it("should detect FastAPI application", () => {
			const code = `
from fastapi import FastAPI

app = FastAPI(
	title="My API",
	description="API description",
	version="1.0.0"
)
`

			const node = new MockNode("assignment", code)
			const metadata = extractFastAPIApplicationMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.applicationType).toBe("FastAPI")
			expect(metadata?.title).toBe("My API")
			expect(metadata?.description).toBe("API description")
			expect(metadata?.version).toBe("1.0.0")
		})

		it("should detect APIRouter", () => {
			const code = `
from fastapi import APIRouter

router = APIRouter(
	prefix="/users",
	tags=["users"]
)
`

			const node = new MockNode("assignment", code)
			const metadata = extractFastAPIApplicationMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.applicationType).toBe("APIRouter")
		})

		it("should detect CORS middleware", () => {
			const code = `
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
	CORSMiddleware,
	allow_origins=["*"],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)
`

			const node = new MockNode("call_expression", code)
			const metadata = extractFastAPIApplicationMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.corsEnabled).toBe(true)
			expect(metadata?.corsConfig?.allowOrigins).toContain("*")
			expect(metadata?.corsConfig?.allowCredentials).toBe(true)
		})

		it("should detect exception handlers", () => {
			const code = `
@app.exception_handler(ValueError)
async def value_error_exception_handler(request: Request, exc: ValueError):
	return JSONResponse(
		status_code=400,
		content={"message": exc.__str__()},
	)
`

			const node = new MockNode("decorated_definition", code)
			const metadata = extractFastAPIApplicationMetadata(node as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.exceptionHandlers).toBeDefined()
			expect(metadata?.exceptionHandlers?.[0].exceptionClass).toBe("ValueError")
			expect(metadata?.exceptionHandlers?.[0].handlerFunction).toBe("value_error_exception_handler")
			expect(metadata?.exceptionHandlers?.[0].isAsync).toBe(true)
		})

		it("should detect static files", () => {
			const code = `
from fastapi.staticfiles import StaticFiles

app.mount("/static", StaticFiles(directory="static"), name="static")
`

			const node = new MockNode("call_expression", code)
			const metadata = extractFastAPIApplicationMetadata(node as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.staticFiles).toBeDefined()
			expect(metadata?.staticFiles?.path).toBe("/static")
			expect(metadata?.staticFiles?.directory).toBe("static")
			expect(metadata?.staticFiles?.name).toBe("static")
		})
	})

	describe("FastAPI Pydantic Model Detection", () => {
		it("should detect basic BaseModel", () => {
			const code = `
from pydantic import BaseModel

class UserSchema(BaseModel):
	id: int
	name: str
	email: str
`

			const node = new MockNode("class_definition", code)
			const metadata = extractFastAPIPydanticModelMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.modelType).toBe("BaseModel")
			expect(metadata?.className).toBe("UserSchema")
			expect(metadata?.fields).toBeDefined()
			expect(metadata?.fields?.length).toBe(3)
		})

		it("should detect Settings model", () => {
			const code = `
from pydantic import BaseSettings

class Settings(BaseSettings):
	database_url: str
	secret_key: str
	
	class Config:
		env_file = ".env"
`

			const node = new MockNode("class_definition", code)
			const metadata = extractFastAPIPydanticModelMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.modelType).toBe("Settings")
			expect(metadata?.className).toBe("Settings")
		})

		it("should detect GenericModel", () => {
			const code = `
from pydantic.generics import GenericModel, TypeVar, Generic

T = TypeVar('T')

class ResponseModel(GenericModel, Generic[T]):
	data: T
	message: str
`

			const node = new MockNode("class_definition", code)
			const metadata = extractFastAPIPydanticModelMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.modelType).toBe("GenericModel")
			expect(metadata?.isGeneric).toBe(true)
			expect(metadata?.typeParameters).toContain("T")
		})

		it("should detect field validation", () => {
			const code = `
from pydantic import BaseModel, Field

class UserSchema(BaseModel):
	name: str = Field(..., min_length=1, max_length=50)
	age: int = Field(..., ge=18, le=120)
	email: str = Field(..., regex=r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
`

			const node = new MockNode("class_definition", code)
			const metadata = extractFastAPIPydanticModelMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.fields).toBeDefined()
			const nameField = metadata?.fields?.find((f) => f.name === "name")
			expect(nameField?.validation?.minLength).toBe(1)
			expect(nameField?.validation?.maxLength).toBe(50)

			const ageField = metadata?.fields?.find((f) => f.name === "age")
			expect(ageField?.validation?.minValue).toBe(18)
			expect(ageField?.validation?.maxValue).toBe(120)

			const emailField = metadata?.fields?.find((f) => f.name === "email")
			expect(emailField?.validation?.regex).toBeDefined()
		})

		it("should detect validators", () => {
			const code = `
from pydantic import BaseModel, validator

class UserSchema(BaseModel):
	password: str
	password_confirm: str
	
	@validator('password_confirm')
	def passwords_match(cls, v, values):
		if 'password' in values and v != values['password']:
			raise ValueError('passwords do not match')
		return v
`

			const node = new MockNode("class_definition", code)
			const metadata = extractFastAPIPydanticModelMetadata(node as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.validators).toBeDefined()
			expect(metadata?.validators?.[0].fieldName).toBe("password_confirm")
			expect(metadata?.validators?.[0].validatorType).toBe("validator")
			expect(metadata?.validators?.[0].methodName).toBe("passwords_match")
		})

		it("should detect model config", () => {
			const code = `
from pydantic import BaseModel

class UserSchema(BaseModel):
	id: int
	name: str
	
	class Config:
		case_sensitive = True
		extra = 'forbid'
		json_loads = 'custom_loader'
`

			const node = new MockNode("class_definition", code)
			const metadata = extractFastAPIPydanticModelMetadata(node as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.config).toBeDefined()
			expect(metadata?.config?.caseSensitive).toBe(true)
			expect(metadata?.config?.extra).toBe("forbid")
			expect(metadata?.config?.jsonLoads).toBe("custom_loader")
		})
	})

	describe("FastAPI Middleware Detection", () => {
		it("should detect custom middleware", () => {
			const code = `
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
	start_time = time.time()
	response = await call_next(request)
	process_time = time.time() - start_time
	response.headers["X-Process-Time"] = str(process_time)
	return response
`

			const node = new MockNode("decorated_definition", code)
			const metadata = extractFastAPIRouteMetadata(node as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.middleware).toContain("http")
		})
	})

	describe("Complex FastAPI Patterns", () => {
		it("should detect complete FastAPI application with all features", () => {
			const code = `
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI(
	title="User Management API",
	description="API for managing users",
	version="1.0.0"
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

class UserBase(BaseModel):
	username: str
	email: str

class UserCreate(UserBase):
	password: str

class User(UserBase):
	id: int
	is_active: bool = True

	class Config:
		orm_mode = True

def get_current_user(token: str = Depends(oauth2_scheme)):
	# Token validation logic here
	pass

@app.post("/users/", response_model=User)
async def create_user(user: UserCreate, current_user: User = Depends(get_current_user)):
	return user

@app.get("/users/{user_id}", response_model=User)
async def get_user(user_id: int, current_user: User = Depends(get_current_user)):
	return user

@app.get("/users/", response_model=List[User])
async def get_users(skip: int = 0, limit: int = 100, current_user: User = Depends(get_current_user)):
	return []

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
	return JSONResponse(
		status_code=exc.status_code,
		content={"message": exc.detail},
	)
`

			// Test application metadata
			const appNode = new MockNode("assignment", code)
			const appMetadata = extractFastAPIApplicationMetadata(appNode as Node, code)

			expect(appMetadata).toBeDefined()
			expect(appMetadata?.title).toBe("User Management API")
			expect(appMetadata?.description).toBe("API for managing users")
			expect(appMetadata?.version).toBe("1.0.0")

			// Test model metadata
			const userModelNode = new MockNode(
				"class_definition",
				code.split("class User(")[1].split("class Config")[0],
			)
			const userModelMetadata = extractFastAPIPydanticModelMetadata(userModelNode as Node, code)

			expect(userModelMetadata).toBeDefined()
			expect(userModelMetadata?.className).toBe("User")
			expect(userModelMetadata?.modelType).toBe("BaseModel")
			expect(userModelMetadata?.config).toBeDefined()
			expect(userModelMetadata?.config?.orm_mode).toBeDefined()

			// Test route metadata
			const createRouteNode = new MockNode(
				"decorated_definition",
				code.split('@app.post("/users/")')[1].split("@app.get")[0],
			)
			const createRouteMetadata = extractFastAPIRouteMetadata(createRouteNode as Node, code)

			expect(createRouteMetadata).toBeDefined()
			expect(createRouteMetadata?.httpMethod).toBe("POST")
			expect(createRouteMetadata?.routePath).toBe("/users/")
			expect(createRouteMetadata?.responseModel).toBe("User")
			expect(createRouteMetadata?.dependencies).toContain("get_current_user")
		})
	})
})
