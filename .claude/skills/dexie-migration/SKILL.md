---
name: dexie-migration
description: Safely add or change indexes in the Dexie schema. Bumps the version number, updates the stores() definition, and audits all affected queries in one pass.
---

When the user needs to add, remove, or change an index on any Dexie table, follow this workflow to avoid the SchemaError and query bugs that come from mismatched indexes.

## Workflow

### 1. Identify the change
Understand what index needs to be added/removed/changed and on which table.

### 2. Read the current schema
Read `src/db/database.ts`. Note the current highest version number.

### 3. Add a new version block
NEVER edit an existing `this.version(N).stores({})` block.
Add a NEW `this.version(N+1).stores({})` block with ONLY the tables that changed.
Dexie merges unchanged tables from the previous version automatically.

Example — adding `lastName` index to tenants:
```typescript
this.version(5).stores({
  tenants: '++id, unitId, propertyId, firstName, lastName, createdAt',
});
```

### 4. Rules for index definitions
- **Primary key**: `++id` (auto-increment) — always first
- **Single index**: just the field name, e.g. `propertyId`
- **Compound index**: `[field1+field2]`, e.g. `[month+year]`
- **NEVER index boolean fields** — IndexedDB does not support boolean keys; use `.filter()` instead
- Listing a field in the store definition does NOT make it required — it just adds an index

### 5. Audit all queries that use the changed table
Search every file in `src/` for `db.<tableName>.` and check:

**orderBy(field)** — field must be in the index definition.
- If not indexed → change to `orderBy('id')` or `toArray()` + JS sort.

**where('field')** — field must be in the index definition.
- Booleans: never use `where('boolField')` → use `.filter(n => !n.field)` instead.

**where({ field1, field2 })** — requires a `[field1+field2]` compound index.
- If no compound index → change to `where('field1').equals(val).filter(n => n.field2 === val2)`.

**where('[field1+field2]').equals([v1, v2])** — requires `[field1+field2]` compound index. ✓

### 6. Type-check
```
npx tsc --noEmit
```
Must pass with zero errors before declaring done.

### 7. Report
List every query that was changed and why.
