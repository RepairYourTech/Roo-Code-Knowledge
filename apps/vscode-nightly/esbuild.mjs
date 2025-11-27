#!/usr/bin/env node

import { build } from 'esbuild'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configuration for the nightly build
const nightlyConfig = {
    name: 'roo-code-nightly',
    displayName: 'Roo Code (Nightly)',
    description: 'Roo Code (AI-powered coding assistant) - Nightly build',
    publisher: 'RooVeterinaryInc',
    version: '4.123.0-nightly',
    repository: {
        type: 'git',
        url: 'https://github.com/RooVeterinaryInc/roo-cline.git'
    }
}

async function runNightlyBuild() {
    console.log('🚀 Starting nightly VSCode extension build...')
    
    try {
        // Clean build directory
        const buildDir = path.join(__dirname, 'build')
        if (fs.existsSync(buildDir)) {
            fs.rmSync(buildDir, { recursive: true, force: true })
        }
        fs.mkdirSync(buildDir, { recursive: true })

        // Get the root project directory
        const rootDir = path.join(__dirname, '../..')
        const srcDir = path.join(rootDir, 'src')
        const distDir = path.join(buildDir, 'dist')

        console.log('📦 Building extension with ESBuild...')

        // Build the extension
        await build({
            entryPoints: [path.join(srcDir, 'extension.ts')],
            bundle: true,
            outfile: path.join(buildDir, 'dist/extension.js'),
            platform: 'node',
            target: 'node20',
            format: 'cjs',
            sourcemap: true,
            external: ['vscode'],
            define: {
                'process.env.NODE_ENV': '"production"',
                'process.env.IS_NIGHTLY': 'true'
            },
            loader: {
                '.ts': 'ts'
            },
            tsconfig: path.join(rootDir, 'tsconfig.json'),
            plugins: [
                {
                    name: 'copy-files',
                    setup(build) {
                        build.onEnd(async () => {
                            console.log('📋 Copying additional files...')
                            
                            // Copy package.json and modify for nightly
                            const packageJsonPath = path.join(srcDir, 'package.json')
                            if (fs.existsSync(packageJsonPath)) {
                                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
                                
                                // Update for nightly build
                                packageJson.name = nightlyConfig.name
                                packageJson.displayName = nightlyConfig.displayName
                                packageJson.description = nightlyConfig.description
                                packageJson.publisher = nightlyConfig.publisher
                                packageJson.version = nightlyConfig.version
                                packageJson.repository = nightlyConfig.repository
                                packageJson.nightly = true
                                
                                // Remove development dependencies from final package
                                delete packageJson.devDependencies
                                
                                fs.writeFileSync(
                                    path.join(buildDir, 'package.json'),
                                    JSON.stringify(packageJson, null, 2)
                                )
                            }

                            // Copy other necessary files
                            const filesToCopy = [
                                'LICENSE',
                                'README.md',
                                'CHANGELOG.md'
                            ]

                            filesToCopy.forEach(file => {
                                const srcPath = path.join(rootDir, file)
                                const destPath = path.join(buildDir, file)
                                if (fs.existsSync(srcPath)) {
                                    fs.copyFileSync(srcPath, destPath)
                                }
                            })

                            // Copy locales directory if it exists
                            const localesSrc = path.join(rootDir, 'locales')
                            if (fs.existsSync(localesSrc)) {
                                const localesDest = path.join(buildDir, 'locales')
                                copyDirectory(localesSrc, localesDest)
                            }

                            // Copy WASM files
                            const wasmSrc = path.join(srcDir, 'services', 'tree-sitter')
                            const wasmDest = path.join(distDir, 'services', 'tree-sitter')
                            if (fs.existsSync(wasmSrc)) {
                                copyDirectory(wasmSrc, wasmDest)
                                console.log('✅ WASM files copied successfully')
                            }

                            // Copy other assets if they exist
                            const assetsSrc = path.join(srcDir, 'assets')
                            if (fs.existsSync(assetsSrc)) {
                                const assetsDest = path.join(distDir, 'assets')
                                copyDirectory(assetsSrc, assetsDest)
                            }

                            console.log('✅ Build completed successfully!')
                        })
                    }
                }
            ]
        })

        console.log('📦 Build process initiated...')
        
    } catch (error) {
        console.error('❌ Build failed:', error)
        process.exit(1)
    }
}

function copyDirectory(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true })
    }
    
    const entries = fs.readdirSync(src, { withFileTypes: true })
    
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name)
        const destPath = path.join(dest, entry.name)
        
        if (entry.isDirectory()) {
            copyDirectory(srcPath, destPath)
        } else {
            fs.copyFileSync(srcPath, destPath)
        }
    }
}

// Run the build
runNightlyBuild().catch(console.error)
