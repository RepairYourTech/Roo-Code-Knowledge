# Phase 10, Task 3: Type System Relationships Implementation Plan

## Overview

Extract type information from LSP integration (Phase 6) and create type system relationships in the Neo4j graph database.

## Current State Analysis

### Existing LSP Integration (Phase 6)

- ✅ **LSPService** implemented in `src/services/code-index/lsp/lsp-service.ts`
- ✅ **TypeInfo interface** with type string, isInferred flag, documentation
- ✅ **SignatureInfo interface** with parameters, return type, type parameters
- ✅ **ParameterInfo interface** with name, type, isOptional, defaultValue
- ✅ **LSPTypeInfo** stored in CodeBlock.lspTypeInfo field
- ✅ **Enrichment** happens in CodeParser.enrichBlocksWithLSP()

### What We Have

```typescript
interface LSPTypeInfo {
	typeInfo?: TypeInfo // Variable/property type
	signatureInfo?: SignatureInfo // Function/method signature
	lspAvailable: boolean
}

interface TypeInfo {
	type: string // e.g., "string", "Promise<User>", "number[]"
	isInferred: boolean
	documentation?: string
}

interface SignatureInfo {
	name: string
	parameters: ParameterInfo[] // Each has name + type
	returnType: string // e.g., "Promise<void>", "User"
	typeParameters?: string[] // Generics like <T, K>
}
```

## Relationship Types to Implement

### 1. HAS_TYPE (Variable/Property → Type)

**Purpose:** Link variables and properties to their types
**Example:** `const user: User` → HAS_TYPE → User class

### 2. ACCEPTS_TYPE (Function/Method → Parameter Type)

**Purpose:** Link functions to the types they accept as parameters
**Example:** `function login(username: string)` → ACCEPTS_TYPE → string

### 3. RETURNS_TYPE (Function/Method → Return Type)

**Purpose:** Link functions to their return types
**Example:** `function getUser(): Promise<User>` → RETURNS_TYPE → Promise<User>

## Implementation Strategy

### Step 1: Extend Neo4j Interface

Add new relationship types to `CodeRelationship` union:

```typescript
export interface CodeRelationship {
	fromId: string
	toId: string
	type:
		| "CALLS"
		| "CALLED_BY"
		| "TESTS"
		| "TESTED_BY"
		| "HAS_TYPE" // NEW
		| "ACCEPTS_TYPE" // NEW
		| "RETURNS_TYPE" // NEW
		| "IMPORTS"
		| "EXTENDS"
		| "IMPLEMENTS"
		| "CONTAINS"
		| "DEFINES"
		| "USES"
	metadata?: Record<string, unknown>
}
```

### Step 2: Extract Type Relationships in GraphIndexer

Add type relationship extraction to `extractRelationships()` method:

```typescript
// Phase 10, Task 3: Extract type relationships from LSP info
if (block.lspTypeInfo?.lspAvailable) {
	// Extract HAS_TYPE for variables/properties
	if (block.lspTypeInfo.typeInfo && (block.type === "variable" || block.type === "property")) {
		const typeRelationships = this.extractHasTypeRelationships(block, allBlocks)
		relationships.push(...typeRelationships)
	}

	// Extract ACCEPTS_TYPE and RETURNS_TYPE for functions/methods
	if (block.lspTypeInfo.signatureInfo && (block.type === "function" || block.type === "method")) {
		const paramTypeRelationships = this.extractAcceptsTypeRelationships(block, allBlocks)
		const returnTypeRelationships = this.extractReturnsTypeRelationships(block, allBlocks)
		relationships.push(...paramTypeRelationships)
		relationships.push(...returnTypeRelationships)
	}
}
```

### Step 3: Implement Helper Methods

#### extractHasTypeRelationships()

```typescript
private extractHasTypeRelationships(block: CodeBlock, allBlocks: CodeBlock[]): CodeRelationship[] {
    const relationships: CodeRelationship[] = []
    const typeInfo = block.lspTypeInfo?.typeInfo

    if (!typeInfo) return relationships

    // Parse type string to extract base type (handle generics, arrays, unions)
    const baseTypes = this.parseTypeString(typeInfo.type)

    for (const typeName of baseTypes) {
        // Find type definition in allBlocks
        const typeBlock = this.findTypeDefinition(typeName, block, allBlocks)

        if (typeBlock) {
            relationships.push({
                fromId: this.generateNodeId(block),
                toId: this.generateNodeId(typeBlock),
                type: 'HAS_TYPE',
                metadata: {
                    typeString: typeInfo.type,
                    isInferred: typeInfo.isInferred,
                    source: 'lsp'
                }
            })
        }
    }

    return relationships
}
```

#### extractAcceptsTypeRelationships()

```typescript
private extractAcceptsTypeRelationships(block: CodeBlock, allBlocks: CodeBlock[]): CodeRelationship[] {
    const relationships: CodeRelationship[] = []
    const signatureInfo = block.lspTypeInfo?.signatureInfo

    if (!signatureInfo || !signatureInfo.parameters) return relationships

    for (const param of signatureInfo.parameters) {
        const baseTypes = this.parseTypeString(param.type)

        for (const typeName of baseTypes) {
            const typeBlock = this.findTypeDefinition(typeName, block, allBlocks)

            if (typeBlock) {
                relationships.push({
                    fromId: this.generateNodeId(block),
                    toId: this.generateNodeId(typeBlock),
                    type: 'ACCEPTS_TYPE',
                    metadata: {
                        parameterName: param.name,
                        typeString: param.type,
                        isOptional: param.isOptional,
                        source: 'lsp'
                    }
                })
            }
        }
    }

    return relationships
}
```

#### extractReturnsTypeRelationships()

```typescript
private extractReturnsTypeRelationships(block: CodeBlock, allBlocks: CodeBlock[]): CodeRelationship[] {
    const relationships: CodeRelationship[] = []
    const signatureInfo = block.lspTypeInfo?.signatureInfo

    if (!signatureInfo || !signatureInfo.returnType) return relationships

    const baseTypes = this.parseTypeString(signatureInfo.returnType)

    for (const typeName of baseTypes) {
        const typeBlock = this.findTypeDefinition(typeName, block, allBlocks)

        if (typeBlock) {
            relationships.push({
                fromId: this.generateNodeId(block),
                toId: this.generateNodeId(typeBlock),
                type: 'RETURNS_TYPE',
                metadata: {
                    typeString: signatureInfo.returnType,
                    source: 'lsp'
                }
            })
        }
    }

    return relationships
}
```

### Step 4: Implement Type Parsing Utilities

#### parseTypeString()

Handles complex type expressions:

- **Primitives:** `string`, `number`, `boolean`
- **Arrays:** `string[]`, `Array<string>`
- **Generics:** `Promise<User>`, `Map<string, User>`
- **Unions:** `string | number | null`
- **Intersections:** `User & Timestamps`
- **Tuples:** `[string, number]`

```typescript
private parseTypeString(typeString: string): string[] {
    const types: string[] = []

    // Remove whitespace
    const cleaned = typeString.trim()

    // Handle union types (A | B | C)
    if (cleaned.includes('|')) {
        const unionTypes = cleaned.split('|').map(t => t.trim())
        for (const unionType of unionTypes) {
            types.push(...this.parseTypeString(unionType))
        }
        return types
    }

    // Handle intersection types (A & B & C)
    if (cleaned.includes('&')) {
        const intersectionTypes = cleaned.split('&').map(t => t.trim())
        for (const intersectionType of intersectionTypes) {
            types.push(...this.parseTypeString(intersectionType))
        }
        return types
    }

    // Handle array types (T[])
    if (cleaned.endsWith('[]')) {
        const baseType = cleaned.slice(0, -2)
        types.push(...this.parseTypeString(baseType))
        return types
    }

    // Handle generic types (Generic<T, K>)
    const genericMatch = cleaned.match(/^([^<]+)<(.+)>$/)
    if (genericMatch) {
        const [, baseType, typeArgs] = genericMatch
        types.push(baseType.trim())

        // Parse type arguments recursively
        const typeArgsList = this.splitTypeArguments(typeArgs)
        for (const typeArg of typeArgsList) {
            types.push(...this.parseTypeString(typeArg))
        }
        return types
    }

    // Skip primitives and built-in types
    const builtInTypes = ['string', 'number', 'boolean', 'void', 'any', 'unknown', 'never', 'null', 'undefined']
    if (!builtInTypes.includes(cleaned.toLowerCase())) {
        types.push(cleaned)
    }

    return types
}

private splitTypeArguments(typeArgs: string): string[] {
    // Split by comma, but respect nested generics
    const args: string[] = []
    let current = ''
    let depth = 0

    for (const char of typeArgs) {
        if (char === '<') depth++
        else if (char === '>') depth--
        else if (char === ',' && depth === 0) {
            args.push(current.trim())
            current = ''
            continue
        }
        current += char
    }

    if (current.trim()) {
        args.push(current.trim())
    }

    return args
}
```

#### findTypeDefinition()

Finds the block that defines a type:

```typescript
private findTypeDefinition(typeName: string, currentBlock: CodeBlock, allBlocks: CodeBlock[]): CodeBlock | null {
    // Look for class, interface, type alias, or enum definitions
    const typeBlock = allBlocks.find(block =>
        (block.type === 'class' ||
         block.type === 'interface' ||
         block.type === 'type_alias' ||
         block.type === 'enum') &&
        block.identifier === typeName
    )

    return typeBlock || null
}
```

## Testing Strategy

### Unit Tests

1. Test `parseTypeString()` with various type expressions
2. Test `findTypeDefinition()` with different type definitions
3. Test relationship extraction with mock LSP data

### Integration Tests

1. Index a TypeScript file with type annotations
2. Verify HAS_TYPE relationships are created
3. Verify ACCEPTS_TYPE relationships are created
4. Verify RETURNS_TYPE relationships are created
5. Query Neo4j to validate relationships

### Example Test Cases

```typescript
// Test 1: Simple variable type
const user: User = getUser()
// Expected: user block HAS_TYPE → User class

// Test 2: Function with parameters
function login(username: string, password: string): Promise<User>
// Expected: login ACCEPTS_TYPE → string (2x)
// Expected: login RETURNS_TYPE → Promise, User

// Test 3: Generic types
const users: Array<User> = []
// Expected: users HAS_TYPE → Array, User

// Test 4: Union types
let value: string | number | null
// Expected: value HAS_TYPE → string, number (skip null)
```

## Success Criteria

- ✅ Can link variables to their types
- ✅ Can link function parameters to their types
- ✅ Can link function return values to their types
- ✅ Can answer "what type is this variable?"
- ✅ Can answer "what functions return this type?"
- ✅ Can answer "what functions accept this type as a parameter?"
- ✅ Handles complex types (generics, unions, arrays)
- ✅ All type checks and linter pass
- ✅ Changes committed and pushed to remote

## Progress Impact

- **Before:** 58% complete (after Phase 10, Task 2)
- **After:** ~66% complete (estimated)
- **Gap Closed:** +8% toward world-class status
