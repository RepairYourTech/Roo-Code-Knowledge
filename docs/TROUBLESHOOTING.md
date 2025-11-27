# Troubleshooting Guide

This guide helps you resolve common issues with Roo-Cline extension.

## WASM Files

### Symptoms

You may encounter the following error messages related to WASM files:

- "Cannot locate tree-sitter WASM files"
- "WASM directory validation failed"
- "Missing critical files"
- "Failed to load language parser"
- Parser loading failures during code analysis

### Diagnosis

To diagnose WASM-related issues:

1. **Run the diagnostic command**: Use `Roo-Cline: Check WASM Setup` command from the Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
2. **Check the Output channel**: The diagnostic results are displayed in the Roo-Cline output channel
3. **Review the health status**: A healthy setup should show:
    - ✅ WASM directory exists
    - ✅ All critical files present
    - ✅ Files have valid sizes (> 1KB)
    - ✅ web-tree-sitter package installed

### Solutions

#### Option 1: Download WASM Files (Recommended)

1. Open Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
2. Type "Roo-Cline: Download Tree-sitter WASM Files"
3. Select the command and wait for download to complete
4. Reload VS Code if prompted

#### Option 2: Regenerate Static WASM Files

For development environments:

1. Navigate to the `src/` directory
2. Run `pnpm regenerate-wasms`
3. Verify files exist in `src/wasms/tree-sitter/`
4. Rebuild the extension: `pnpm bundle`

#### Option 3: Manual Verification

1. Check if `dist/services/tree-sitter/` directory exists
2. Verify critical files are present:
    - `tree-sitter.wasm` (170-210 KB)
    - `tree-sitter-javascript.wasm`
    - `tree-sitter-typescript.wasm`
    - `tree-sitter-python.wasm`
3. Check file sizes (should be > 1KB each)

### Common Issues

#### Network/Firewall Issues

If downloads fail:

- Check internet connection
- Verify corporate firewall/proxy settings
- Try downloading from a different network
- Ensure CDN (unpkg.com) is accessible

#### Permission Issues

If you encounter permission errors:

- Ensure write permissions to extension directory
- On Linux/Mac, check file ownership: `ls -la`
- Try running VS Code with appropriate permissions
- On Windows, run VS Code as Administrator if needed

#### Corrupted Files

If files exist but are invalid:

- Delete existing WASM files
- Re-run download command
- Verify file sizes match expected values:
    - `tree-sitter.wasm`: ~180KB
    - Language-specific files: ~50-150KB each

#### Development Environment

For developers setting up the project:

1. Ensure `pnpm install` completed successfully
2. Check `node_modules/` contains tree-sitter packages:
    ```bash
    ls node_modules/@tree-sitter-grammars/
    ls node_modules/tree-sitter-*/
    ```
3. Verify build process completed without errors:
    ```bash
    pnpm build
    pnpm bundle
    ```

#### Extension Loading Issues

If WASM files exist but aren't loaded:

1. Check VS Code extension is enabled:
    - Open Extensions view (Ctrl+Shift+X)
    - Search for "Roo-Cline"
    - Ensure it's enabled
2. Restart VS Code completely
3. Clear extension cache:
    ```bash
    # Windows
    %APPDATA%\Code\User\cachedExtensions
    # Mac
    ~/Library/Application Support/Code/User/cachedExtensions
    # Linux
    ~/.config/Code/User/cachedExtensions
    ```

### Advanced Troubleshooting

#### Environment Variables

For debugging, you can use these environment variables:

```bash
# Disable WASM directory caching
export ROO_CODE_DISABLE_WASM_CACHE=true

# Enable debug logging
export ROO_CODE_LOG_LEVEL=debug
```

#### Manual WASM File Locations

The extension searches for WASM files in this order:

1. `dist/services/tree-sitter/` (production builds)
2. `src/wasms/tree-sitter/` (static bundled source)
3. `src/dist/services/tree-sitter/` (monorepo development)
4. `out/services/tree-sitter/` (alternative build output)
5. `services/tree-sitter/` (direct path)
6. `src/services/tree-sitter/` (development fallback)

#### Package Dependencies

Ensure these packages are installed:

```json
{
	"dependencies": {
		"web-tree-sitter": "^0.20.0",
		"tree-sitter-wasms": "^1.0.0"
	}
}
```

### Getting Help

If you continue to experience issues:

1. **Check GitHub Issues**: Search existing issues at [https://github.com/RooCline/Roo-Cline/issues](https://github.com/RooCline/Roo-Cline/issues)
2. **Create New Issue**: Include:
    - Operating system and version
    - VS Code version
    - Extension version
    - Diagnostic report output
    - Steps to reproduce
3. **Community Support**: Join discussions in GitHub Discussions

### Related Documentation

- [Main README](../README.md)
- [Development Setup](../DEVELOPMENT.md)
- [API Documentation](../docs/API.md)
