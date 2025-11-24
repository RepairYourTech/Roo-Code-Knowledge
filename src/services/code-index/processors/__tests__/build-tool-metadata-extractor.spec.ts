import { Node } from "web-tree-sitter"
import {
	extractBuildToolConfigurationMetadata,
	BuildToolConfigurationMetadata,
	BuildToolDependency,
	BuildToolPlugin,
	BuildToolLoader,
} from "../metadata-extractor"

// Mock tree-sitter node for testing
function createMockNode(type: string, text: string, children?: Node[]): Node {
	const node = {
		type,
		text,
		children: children || [],
		childForFieldName: (name: string) => {
			// Simple mock implementation
			return null
		},
		startPosition: { row: 0, column: 0 },
		endPosition: { row: 0, column: 0 },
	} as Node

	return node
}

describe("Build Tool Configuration Metadata Extractor", () => {
	describe("JavaScript/TypeScript Build Tools", () => {
		describe("package.json", () => {
			it("should extract metadata from package.json with dependencies", () => {
				const packageJsonContent = `{
					"name": "test-project",
					"version": "1.0.0",
					"dependencies": {
						"react": "^18.0.0",
						"express": "^4.18.0"
					},
					"devDependencies": {
						"typescript": "^5.0.0",
						"jest": "^29.0.0"
					},
					"scripts": {
						"build": "webpack --mode production",
						"test": "jest",
						"dev": "vite"
					}
				}`

				const node = createMockNode("program", packageJsonContent)
				const metadata = extractBuildToolConfigurationMetadata(node, "package.json", packageJsonContent)

				expect(metadata).toBeDefined()
				expect(metadata?.toolType).toBe("npm")
				expect(metadata?.configurationType).toBe("json")
				expect(metadata?.dependencies).toHaveLength(4)

				if (metadata?.dependencies) {
					const reactDep = metadata.dependencies.find((d) => d.name === "react")
					expect(reactDep).toBeDefined()
					expect(reactDep?.type).toBe("runtime")
					expect(reactDep?.version).toBe("^18.0.0")

					const typescriptDep = metadata.dependencies.find((d) => d.name === "typescript")
					expect(typescriptDep).toBeDefined()
					expect(typescriptDep?.type).toBe("development")
					expect(typescriptDep?.version).toBe("^5.0.0")
				}

				expect(metadata?.scripts).toBeDefined()
				expect(metadata?.scripts?.build).toBe("webpack --mode production")
				expect(metadata?.scripts?.test).toBe("jest")
				expect(metadata?.scripts?.dev).toBe("vite")
			})

			it("should handle malformed package.json gracefully", () => {
				const malformedJson = "{ invalid json content"
				const node = createMockNode("program", malformedJson)
				const metadata = extractBuildToolConfigurationMetadata(node, "package.json", malformedJson)

				// Should not throw and should return metadata with empty arrays
				expect(metadata).toBeDefined()
				expect(metadata?.dependencies).toEqual([])
				expect(metadata?.plugins).toEqual([])
				expect(metadata?.loaders).toEqual([])
			})
		})

		describe("webpack.config.js", () => {
			it("should extract metadata from webpack configuration", () => {
				const webpackConfig = `const path = require('path');
				module.exports = {
					mode: 'development',
					entry: './src/index.js',
					output: {
						path: path.resolve(__dirname, 'dist'),
						filename: 'bundle.js'
					},
					module: {
						rules: [
							{
								test: /\\.js$/,
								use: 'babel-loader'
							},
							{
								test: /\\.css$/,
								use: 'css-loader'
							}
						]
					},
					plugins: [
						new webpack.ProvidePlugin({
							$: 'jquery'
						}),
						new HtmlWebpackPlugin()
					]
				}`

				const node = createMockNode("program", webpackConfig)
				const metadata = extractBuildToolConfigurationMetadata(node, "webpack.config.js", webpackConfig)

				expect(metadata).toBeDefined()
				expect(metadata?.toolType).toBe("webpack")
				expect(metadata?.configurationType).toBe("javascript")
				expect(metadata?.environment).toBe("development")
				expect(metadata?.loaders).toHaveLength(2)
				expect(metadata?.plugins).toHaveLength(2)

				if (metadata?.loaders) {
					const babelLoader = metadata.loaders.find((l) => l.name === "babel-loader")
					expect(babelLoader).toBeDefined()
				}

				if (metadata?.plugins) {
					const providePlugin = metadata.plugins.find((p) => p.name === "ProvidePlugin")
					expect(providePlugin).toBeDefined()
				}
			})
		})

		describe("vite.config.js", () => {
			it("should extract metadata from Vite configuration", () => {
				const viteConfig = `import { defineConfig } from 'vite'
				import react from '@vitejs/plugin-react'

				export default defineConfig({
					plugins: [react()],
					build: {
						outDir: 'dist',
						sourcemap: true,
						minify: true
					},
					server: {
						port: 3000,
						hmr: true
					}
				})`

				const node = createMockNode("program", viteConfig)
				const metadata = extractBuildToolConfigurationMetadata(node, "vite.config.js", viteConfig)

				expect(metadata).toBeDefined()
				expect(metadata?.toolType).toBe("vite")
				expect(metadata?.configurationType).toBe("typescript")
				expect(metadata?.plugins).toHaveLength(1)
				expect(metadata?.outputPath).toBe("dist")
				expect(metadata?.enableSourceMaps).toBe(true)
				expect(metadata?.enableMinification).toBe(true)
				expect(metadata?.enableHotReload).toBe(true)
			})
		})

		describe("tsconfig.json", () => {
			it("should extract metadata from TypeScript configuration", () => {
				const tsConfig = `{
					"compilerOptions": {
						"target": "ES2020",
						"module": "commonjs",
						"outDir": "./dist",
						"rootDir": "./src",
						"sourceMap": true,
						"declaration": true,
						"strict": true
					},
					"include": ["src/**/*"],
					"exclude": ["node_modules", "dist"]
				}`

				const node = createMockNode("program", tsConfig)
				const metadata = extractBuildToolConfigurationMetadata(node, "tsconfig.json", tsConfig)

				expect(metadata).toBeDefined()
				expect(metadata?.toolType).toBe("typescript")
				expect(metadata?.configurationType).toBe("json")
				expect(metadata?.outputPath).toBe("./dist")
				expect(metadata?.sourcePaths).toContain("./src")
				expect(metadata?.enableSourceMaps).toBe(true)
			})
		})
	})

	describe("Python Build Tools", () => {
		describe("pyproject.toml", () => {
			it("should extract metadata from Poetry configuration", () => {
				const pyprojectToml = `[build-system]
requires = ["poetry-core"]
build-backend = "poetry.core.masonry.api"

[tool.poetry]
name = "test-project"
version = "1.0.0"
description = "A test project"
authors = ["Test Author <test@example.com>"]

[tool.poetry.dependencies]
python = "^3.8"
requests = "^2.28.0"
flask = "^2.3.0"

[tool.poetry.group.dev.dependencies]
pytest = "^7.0.0"
black = "^23.0.0"
mypy = "^1.0.0"

[tool.poetry.scripts]
test = "pytest"
build = "poetry build"
`

				const node = createMockNode("program", pyprojectToml)
				const metadata = extractBuildToolConfigurationMetadata(node, "pyproject.toml", pyprojectToml)

				expect(metadata).toBeDefined()
				expect(metadata?.toolType).toBe("poetry")
				expect(metadata?.configurationType).toBe("toml")
				expect(metadata?.dependencies).toHaveLength(4)

				if (metadata?.dependencies) {
					const pythonDep = metadata.dependencies.find((d) => d.name === "python")
					expect(pythonDep).toBeDefined()
					expect(pythonDep?.type).toBe("runtime")
					expect(pythonDep?.version).toBe("^3.8")

					const pytestDep = metadata.dependencies.find((d) => d.name === "pytest")
					expect(pytestDep).toBeDefined()
					expect(pytestDep?.type).toBe("development")
					expect(pytestDep?.version).toBe("^7.0.0")
				}

				expect(metadata?.scripts).toBeDefined()
				expect(metadata?.scripts?.test).toBe("pytest")
				expect(metadata?.scripts?.build).toBe("poetry build")
			})
		})

		describe("requirements.txt", () => {
			it("should extract metadata from requirements.txt", () => {
				const requirementsTxt = `flask==2.3.0
requests>=2.28.0
django~=4.1.0
numpy
pytest==7.0.0
black==23.0.0`

				const node = createMockNode("program", requirementsTxt)
				const metadata = extractBuildToolConfigurationMetadata(node, "requirements.txt", requirementsTxt)

				expect(metadata).toBeDefined()
				expect(metadata?.toolType).toBe("pip")
				expect(metadata?.configurationType).toBe("text")
				expect(metadata?.dependencies).toHaveLength(5)

				if (metadata?.dependencies) {
					const flaskDep = metadata.dependencies.find((d) => d.name === "flask")
					expect(flaskDep).toBeDefined()
					expect(flaskDep?.type).toBe("runtime")
					expect(flaskDep?.version).toBe("2.3.0")

					const numpyDep = metadata.dependencies.find((d) => d.name === "numpy")
					expect(numpyDep).toBeDefined()
					expect(numpyDep?.type).toBe("runtime")
					expect(numpyDep?.version).toBeUndefined()

					const pytestDep = metadata.dependencies.find((d) => d.name === "pytest")
					expect(pytestDep).toBeDefined()
					expect(pytestDep?.type).toBe("runtime")
					expect(pytestDep?.version).toBe("7.0.0")
				}
			})
		})
	})

	describe("Rust Build Tools", () => {
		describe("Cargo.toml", () => {
			it("should extract metadata from Cargo configuration", () => {
				const cargoToml = `[package]
name = "test-project"
version = "1.0.0"
edition = "2021"

[dependencies]
serde = "1.0"
tokio = { version = "1.0", features = ["full"] }
serde_json = "1.0"

[dev-dependencies]
tokio-test = "0.4"
criterion = "0.5"

[[bin]]
name = "test-binary"
path = "src/main.rs"

[profile.release]
lto = true
codegen-units = 1`

				const node = createMockNode("program", cargoToml)
				const metadata = extractBuildToolConfigurationMetadata(node, "Cargo.toml", cargoToml)

				expect(metadata).toBeDefined()
				expect(metadata?.toolType).toBe("cargo")
				expect(metadata?.configurationType).toBe("toml")
				expect(metadata?.dependencies).toHaveLength(4)

				if (metadata?.dependencies) {
					const serdeDep = metadata.dependencies.find((d) => d.name === "serde")
					expect(serdeDep).toBeDefined()
					expect(serdeDep?.type).toBe("runtime")
					expect(serdeDep?.version).toBe("1.0")

					const tokioTestDep = metadata.dependencies.find((d) => d.name === "tokio-test")
					expect(tokioTestDep).toBeDefined()
					expect(tokioTestDep?.type).toBe("development")
					expect(tokioTestDep?.version).toBe("0.4")
				}
			})
		})
	})

	describe("Java Build Tools", () => {
		describe("pom.xml", () => {
			it("should extract metadata from Maven configuration", () => {
				const pomXml = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.example</groupId>
    <artifactId>test-project</artifactId>
    <version>1.0.0</version>
    <packaging>jar</packaging>

    <dependencies>
        <dependency>
            <groupId>org.springframework</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
            <version>3.0.0</version>
        </dependency>
        <dependency>
            <groupId>junit</groupId>
            <artifactId>junit</artifactId>
            <version>4.13.2</version>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
                <version>3.11.0</version>
                <configuration>
                    <source>17</source>
                    <target>17</target>
                </configuration>
            </plugin>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
                <version>3.0.0</version>
            </plugin>
        </plugins>
    </build>
</project>`

				const node = createMockNode("program", pomXml)
				const metadata = extractBuildToolConfigurationMetadata(node, "pom.xml", pomXml)

				expect(metadata).toBeDefined()
				expect(metadata?.toolType).toBe("maven")
				expect(metadata?.configurationType).toBe("maven_pom")
				expect(metadata?.dependencies).toHaveLength(2)
				expect(metadata?.plugins).toHaveLength(2)

				if (metadata?.dependencies) {
					const springDep = metadata.dependencies.find(
						(d) => d.name === "org.springframework:spring-boot-starter-web",
					)
					expect(springDep).toBeDefined()
					expect(springDep?.type).toBe("runtime")
					expect(springDep?.version).toBe("3.0.0")

					const junitDep = metadata.dependencies.find((d) => d.name === "junit:junit")
					expect(junitDep).toBeDefined()
					expect(junitDep?.type).toBe("development")
					expect(junitDep?.version).toBe("4.13.2")
				}
			})
		})

		describe("build.gradle", () => {
			it("should extract metadata from Gradle configuration", () => {
				const buildGradle = `plugins {
    id 'java'
    id 'org.springframework.boot' version '3.0.0'
    id 'io.spring.dependency-management' version '1.1.0'
}

group = 'com.example'
version = '1.0.0'

java {
    sourceCompatibility = '17'
}

repositories {
    mavenCentral()
}

dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-web'
    implementation 'org.springframework.boot:spring-boot-starter-data-jpa'
    testImplementation 'org.springframework.boot:spring-boot-starter-test'
}

tasks.named('test') {
    useJUnitPlatform()
}`

				const node = createMockNode("program", buildGradle)
				const metadata = extractBuildToolConfigurationMetadata(node, "build.gradle", buildGradle)

				expect(metadata).toBeDefined()
				expect(metadata?.toolType).toBe("gradle")
				expect(metadata?.configurationType).toBe("gradle_build")
				expect(metadata?.dependencies).toHaveLength(3)
				expect(metadata?.plugins).toHaveLength(3)
			})
		})
	})

	describe("Go Build Tools", () => {
		describe("go.mod", () => {
			it("should extract metadata from Go modules", () => {
				const goMod = `module github.com/example/test-project

go 1.21

require (
    github.com/gin-gonic/gin v1.9.0
    github.com/stretchr/testify v1.8.4
)

require (
    github.com/golang/mock v1.6.0
)`

				const node = createMockNode("program", goMod)
				const metadata = extractBuildToolConfigurationMetadata(node, "go.mod", goMod)

				expect(metadata).toBeDefined()
				expect(metadata?.toolType).toBe("go_modules")
				expect(metadata?.configurationType).toBe("go_mod")
				expect(metadata?.dependencies).toHaveLength(2)

				if (metadata?.dependencies) {
					const ginDep = metadata.dependencies.find((d) => d.name === "github.com/gin-gonic/gin")
					expect(ginDep).toBeDefined()
					expect(ginDep?.type).toBe("runtime")
					expect(ginDep?.version).toBe("v1.9.0")

					const testifyDep = metadata.dependencies.find((d) => d.name === "github.com/stretchr/testify")
					expect(testifyDep).toBeDefined()
					expect(testifyDep?.type).toBe("runtime")
					expect(testifyDep?.version).toBe("v1.8.4")
				}
			})
		})
	})

	describe("PHP Build Tools", () => {
		describe("composer.json", () => {
			it("should extract metadata from Composer configuration", () => {
				const composerJson = `{
    "name": "example/test-project",
    "type": "project",
    "description": "A test project",
    "require": {
        "php": "^8.1",
        "laravel/framework": "^10.0",
        "guzzlehttp/guzzle": "^7.0"
    },
    "require-dev": {
        "phpunit/phpunit": "^10.0",
        "laravel/pint": "^1.0"
    },
    "autoload": {
        "psr-4": {
            "App\\\\": "app/"
        }
    },
    "scripts": {
        "test": "vendor/bin/phpunit",
        "lint": "vendor/bin/pint"
    }
}`

				const node = createMockNode("program", composerJson)
				const metadata = extractBuildToolConfigurationMetadata(node, "composer.json", composerJson)

				expect(metadata).toBeDefined()
				expect(metadata?.toolType).toBe("composer")
				expect(metadata?.configurationType).toBe("composer_json")
				expect(metadata?.dependencies).toHaveLength(4)

				if (metadata?.dependencies) {
					const laravelDep = metadata.dependencies.find((d) => d.name === "laravel/framework")
					expect(laravelDep).toBeDefined()
					expect(laravelDep?.type).toBe("runtime")
					expect(laravelDep?.version).toBe("^10.0")

					const phpunitDep = metadata.dependencies.find((d) => d.name === "phpunit/phpunit")
					expect(phpunitDep).toBeDefined()
					expect(phpunitDep?.type).toBe("development")
					expect(phpunitDep?.version).toBe("^10.0")
				}

				expect(metadata?.scripts).toBeDefined()
				expect(metadata?.scripts?.test).toBe("vendor/bin/phpunit")
				expect(metadata?.scripts?.lint).toBe("vendor/bin/pint")
			})
		})
	})

	describe("Docker and CI/CD", () => {
		describe("Dockerfile", () => {
			it("should extract metadata from Docker configuration", () => {
				const dockerfile = `FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]`

				const node = createMockNode("program", dockerfile)
				const metadata = extractBuildToolConfigurationMetadata(node, "Dockerfile", dockerfile)

				expect(metadata).toBeDefined()
				expect(metadata?.toolType).toBe("docker")
				expect(metadata?.configurationType).toBe("dockerfile")
				expect(metadata?.customSettings).toBeDefined()
			})
		})

		describe("docker-compose.yml", () => {
			it("should extract metadata from Docker Compose configuration", () => {
				const dockerCompose = `version: '3.8'

services:
  web:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    depends_on:
      - db

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=testdb
      - POSTGRES_USER=testuser
      - POSTGRES_PASSWORD=testpass
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:`

				const node = createMockNode("program", dockerCompose)
				const metadata = extractBuildToolConfigurationMetadata(node, "docker-compose.yml", dockerCompose)

				expect(metadata).toBeDefined()
				expect(metadata?.toolType).toBe("docker")
				expect(metadata?.configurationType).toBe("yaml")
				expect(metadata?.environment).toBe("production")
			})
		})
	})

	describe("Error Handling", () => {
		it("should handle empty content gracefully", () => {
			const node = createMockNode("program", "")
			const metadata = extractBuildToolConfigurationMetadata(node, "package.json", "")

			expect(metadata).toBeDefined()
			expect(metadata?.dependencies).toEqual([])
			expect(metadata?.plugins).toEqual([])
			expect(metadata?.loaders).toEqual([])
		})

		it("should handle null/undefined inputs gracefully", () => {
			const node = createMockNode("program", "")

			// Test with null content
			const metadata1 = extractBuildToolConfigurationMetadata(node, "package.json", null as any)
			expect(metadata1).toBeDefined()
			expect(metadata1?.dependencies).toEqual([])

			// Test with undefined content
			const metadata2 = extractBuildToolConfigurationMetadata(node, "package.json", undefined as any)
			expect(metadata2).toBeDefined()
			expect(metadata2?.dependencies).toEqual([])
		})

		it("should handle unknown file types gracefully", () => {
			const unknownContent = "some unknown configuration content"
			const node = createMockNode("program", unknownContent)
			const metadata = extractBuildToolConfigurationMetadata(node, "unknown.config.xyz", unknownContent)

			// Should still return metadata but with default fallback
			expect(metadata).toBeDefined()
			expect(metadata?.toolType).toBe("npm") // default fallback
			expect(metadata?.configurationType).toBe("json") // default fallback
		})
	})
})
