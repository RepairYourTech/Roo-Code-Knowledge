const fs = require("fs")

const filename = process.argv[2]
const content = fs.readFileSync(filename, "utf8")
const lines = content.split("\n")

let balance = 0
let inString = false

for (let i = 0; i < lines.length; i++) {
	const line = lines[i]
	let lineBalance = 0

	// Simple comment check (start of line or after whitespace)
	const commentIndex = line.indexOf(";")
	let effectiveLine = line
	if (commentIndex !== -1) {
		// Check if it's a real comment (not inside string)
		// For simplicity, let's assume ; starts a comment if not in string
		// But we need to parse char by char to be sure
	}

	for (let j = 0; j < line.length; j++) {
		const char = line[j]

		if (char === ";") {
			if (!inString) break // Comment starts, ignore rest of line
		}

		if (char === '"') {
			// Handle escaped quotes? Tree-sitter queries use \"
			if (j > 0 && line[j - 1] === "\\") {
				// Escaped quote, ignore
			} else {
				inString = !inString
			}
			continue
		}

		if (inString) continue

		if (char === "(") {
			balance++
			lineBalance++
		} else if (char === ")") {
			balance--
			lineBalance--
		}
	}

	if (balance < 0) {
		console.log(`Error: Balance went negative at line ${i + 1}. Content: ${line}`)
		process.exit(1)
	}
	if ((i + 1) % 50 === 0) {
		console.log(`Line ${i + 1}: Balance = ${balance}`)
	}
}

if (balance !== 0) {
	console.log(`Error: Final balance is ${balance} (expected 0).`)
} else {
	console.log("Balance is OK.")
}
