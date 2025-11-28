import { tiktoken } from "../src/utils/tiktoken"

async function main() {
	console.log("Starting Tiktoken runtime verification...")
	try {
		const count = await tiktoken([{ type: "text", text: "Hello world" }])
		console.log(`Token count: ${count}`)
		if (count > 0) {
			console.log("✅ Tiktoken verification passed!")
		} else {
			console.error("❌ Tiktoken verification failed: Token count is 0")
			process.exit(1)
		}
	} catch (error) {
		console.error("❌ Tiktoken verification failed:", error)
		process.exit(1)
	}
}

main()
