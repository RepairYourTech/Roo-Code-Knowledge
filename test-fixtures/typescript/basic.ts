// Basic Types and Interfaces
interface User {
	id: number
	name: string
	email?: string
}

type ID = string | number

// Class Definition
export class UserService {
	private users: User[] = []

	constructor(initialUsers: User[] = []) {
		this.users = initialUsers
	}

	// Method definition
	public getUser(id: ID): User | undefined {
		return this.users.find((u) => u.id === id)
	}

	// Async method
	async fetchUser(id: ID): Promise<User> {
		return { id: 1, name: "Test" }
	}
}

// Function Declaration
function helper(x: number): number {
	return x * 2
}

// Arrow Function
const multiply = (a: number, b: number) => a * b
