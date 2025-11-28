// npx vitest __tests__/dist_assets.spec.ts

import * as fs from "fs"
import * as path from "path"

describe("dist assets", () => {
	const distPath = path.join(__dirname, "../dist")

	it("should have dist directory", () => {
		expect(fs.existsSync(distPath)).toBe(true)
	})
})
