#!/usr/bin/env node

/**
 * Check script for tiktoken WASM files
 * Validates that required tiktoken WASM files are present
 */

const fs = require("fs")
const path = require("path")

// Check in the static directory as the primary location
// This is where the download script now places the file directly
const TARGET_DIR = path.join(__dirname, "..", "src", "wasms", "tiktoken")

const EXPECTED_TIKTOKEN_FILES = ["tiktoken_bg.wasm"]

function checkTiktokenFiles() {
	console.log("🔍 Checking tiktoken WASM files...\n")

	if (!fs.existsSync(TARGET_DIR)) {
		console.error(`❌ Target directory does not exist: ${TARGET_DIR}`)
		console.error("Please run the build process first or check the directory structure.")
		process.exit(1)
	}

	const existingFiles = fs.readdirSync(TARGET_DIR).filter((file) => file.endsWith(".wasm"))
	const tiktokenFiles = existingFiles.filter((file) => EXPECTED_TIKTOKEN_FILES.includes(file))

	const missingFiles = EXPECTED_TIKTOKEN_FILES.filter((file) => !tiktokenFiles.includes(file))
	const extraFiles = tiktokenFiles.filter((file) => !EXPECTED_TIKTOKEN_FILES.includes(file))

	console.log(`📁 Target directory: ${TARGET_DIR}`)
	console.log(`📋 Expected tiktoken files: ${EXPECTED_TIKTOKEN_FILES.length}`)
	console.log(`✅ Found tiktoken files: ${tiktokenFiles.length}`)

	if (tiktokenFiles.length > 0) {
		console.log("\n📄 Existing tiktoken WASM files:")
		tiktokenFiles.forEach((file) => {
			const filePath = path.join(TARGET_DIR, file)
			const stats = fs.statSync(filePath)
			console.log(`  ✅ ${file} (${stats.size} bytes)`)
		})
	}

	if (missingFiles.length > 0) {
		console.log("\n❌ Missing tiktoken WASM files:")
		missingFiles.forEach((file) => {
			console.log(`  ❌ ${file}`)
		})
	}

	if (extraFiles.length > 0) {
		console.log("\n⚠️  Extra tiktoken WASM files (not in expected list):")
		extraFiles.forEach((file) => {
			console.log(`  ⚠️  ${file}`)
		})
	}

	if (missingFiles.length > 0) {
		console.log("\n🔧 To download missing tiktoken WASM files, run:")
		console.log("   pnpm download-wasms")
		console.log("\nOr run the tiktoken-specific script:")
		console.log("   tsx scripts/download-tiktoken-wasms.js")
		console.log("\n📖 For more information, see:")
		console.log("   https://github.com/openai/tiktoken")
		process.exit(1)
	}

	console.log("\n✅ All tiktoken WASM files are present!")
	console.log("🎉 Tiktoken setup validation successful!")

	// Verify tiktoken_bg.wasm specifically exists and is not empty
	const tiktokenBgPath = path.join(TARGET_DIR, "tiktoken_bg.wasm")
	if (fs.existsSync(tiktokenBgPath)) {
		const stats = fs.statSync(tiktokenBgPath)
		if (stats.size === 0) {
			console.error("\n❌ tiktoken_bg.wasm exists but is empty (0 bytes)")
			console.log("   This indicates a download failure. Please run pnpm download-wasms again.")
			process.exit(1)
		} else {
			console.log(`✅ tiktoken_bg.wasm is valid (${stats.size} bytes)`)
		}
	} else {
		console.error("\n❌ tiktoken_bg.wasm is missing - this is the main tiktoken WASM file")
		console.log("   Without this file, the extension cannot activate properly.")
		process.exit(1)
	}

	process.exit(0)
}

// Run the check
if (require.main === module) {
	checkTiktokenFiles()
}

module.exports = { checkTiktokenFiles }
