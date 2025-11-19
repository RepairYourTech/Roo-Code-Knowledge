# Phase 10, Task 4: Inheritance Relationships Implementation Plan

## Overview

Enhance existing EXTENDS/IMPLEMENTS relationship extraction and create bidirectional EXTENDED_BY/IMPLEMENTED_BY relationships in the Neo4j graph database.

## Current State Analysis

### Existing Implementation

- ✅ **SymbolMetadata interface** has `extends?: string` and `implements?: string[]` fields
- ❌ **Extraction logic** is currently a placeholder (lines 265-276 in graph-indexer.ts)
- ❌ **No bidirectional relationships** (EXTENDED_BY, IMPLEMENTED_BY)
- ❌ **No metadata** for inheritance modifiers (abstract, sealed, final, etc.)

### What We Have

```typescript
interface SymbolMetadata {
	extends?: string // Parent class name
	implements?: string[] // Implemented interfaces
	isAbstract?: boolean // Is abstract class/method
}
```

## Relationship Types to Implement

### 1. EXTENDS (Class → Parent Class)

**Purpose:** Link classes to their parent classes
**Example:** `class UserService extends BaseService` → EXTENDS → BaseService

### 2. EXTENDED_BY (Parent Class → Child Class)

**Purpose:** Reverse relationship for efficient "show me all subclasses" queries
**Example:** BaseService → EXTENDED_BY → UserService

### 3. IMPLEMENTS (Class → Interface)

**Purpose:** Link classes to interfaces they implement
**Example:** `class UserService implements IService` → IMPLEMENTS → IService

### 4. IMPLEMENTED_BY (Interface → Class)

**Purpose:** Reverse relationship for efficient "show me all implementations" queries
**Example:** IService → IMPLEMENTED_BY → UserService

## Implementation Strategy

### Step 1: Extend Neo4j Interface

Add EXTENDED_BY and IMPLEMENTED_BY to CodeRelationship type union

### Step 2: Enhance EXTENDS Extraction

Replace placeholder with actual extraction logic using symbolMetadata.extends

### Step 3: Enhance IMPLEMENTS Extraction

Replace placeholder with actual extraction logic using symbolMetadata.implements

### Step 4: Create Bidirectional Relationships

Add reverse EXTENDED_BY and IMPLEMENTED_BY relationships

## Edge Cases to Handle

1. **Generic base classes:** `class UserService extends BaseService<User>`
    - Extract base type name before `<`
2. **Qualified names:** `class UserService extends services.BaseService`
    - Extract simple name after last `.`
3. **Multiple interfaces:** `class UserService implements IService, ILoggable`
    - Already handled by `implements: string[]`
4. **Abstract classes:** Track via `isAbstract` metadata
5. **Cross-file inheritance:** Parent/interface may be in different file
    - Already handled by searching all blocks

## Success Criteria

- ✅ Can navigate class hierarchies in both directions
- ✅ Can answer "what classes extend this class?"
- ✅ Can answer "what classes implement this interface?"
- ✅ Can answer "show me the inheritance tree for this class"
- ✅ Handles generic base classes
- ✅ Handles multiple interface implementations
- ✅ All type checks and linter pass
- ✅ Changes committed and pushed to remote

## Progress Impact

- **Before:** 66% complete (after Phase 10, Task 3)
- **After:** ~74% complete (estimated)
- **Gap Closed:** +8% toward world-class status
