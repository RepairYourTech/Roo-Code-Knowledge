// Sample TypeScript file for testing
interface User {
	id: number
	name: string
	email?: string
}

class UserService {
	private users: User[] = []

	constructor() {
		console.log("UserService initialized")
	}

	public addUser(user: User): void {
		this.users.push(user)
	}

	public getUserById(id: number): User | undefined {
		return this.users.find((user) => user.id === id)
	}

	public getAllUsers(): User[] {
		return [...this.users]
	}
}

// Function with generics
function createRepository<T>(): {
	add: (item: T) => void
	find: (predicate: (item: T) => boolean) => T | undefined
	getAll: () => T[]
} {
	const items: T[] = []

	return {
		add: (item: T) => items.push(item),
		find: (predicate: (item: T) => boolean) => items.find(predicate),
		getAll: () => [...items],
	}
}

// Enum
enum UserRole {
	ADMIN = "admin",
	USER = "user",
	GUEST = "guest",
}

// Decorator example
function log(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
	const originalMethod = descriptor.value

	descriptor.value = function (...args: any[]) {
		console.log(`Calling ${propertyKey} with args:`, args)
		const result = originalMethod.apply(this, args)
		console.log(`${propertyKey} returned:`, result)
		return result
	}

	return descriptor
}

class ApiService {
	@log
	public async fetchData<T>(url: string): Promise<T> {
		const response = await fetch(url)
		return response.json()
	}
}

// Type alias and union type
type Status = "loading" | "success" | "error"

interface ApiResponse<T> {
	data: T
	status: Status
	message?: string
}

// Export statement
export { UserService, UserRole, ApiService }
export type { User, ApiResponse, Status }
