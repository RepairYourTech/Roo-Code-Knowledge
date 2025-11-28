// Basic Functions
function add(a, b) {
	return a + b
}

// Arrow Functions
const subtract = (a, b) => a - b

// Class
class Calculator {
	constructor() {
		this.value = 0
	}

	add(n) {
		this.value += n
	}
}

// CommonJS Export
module.exports = {
	add,
	Calculator,
}
