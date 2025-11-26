# Location Name Migration Guide

## Problem

The original implementation assumed Spoolman's `/api/v1/location` endpoint returns objects with numeric IDs:

```json
[
  { "id": 1, "name": "Printer room" },
  { "id": 2, "name": "Storage closet" }
]
```

However, Spoolman actually returns location names as a **string array**:

```json
["Printer room", "Storage closet"]
```

This caused `NOT NULL constraint failed: location_order.spoolman_location_id` errors because our database expected numeric IDs that didn't exist.

## Solution

The database schema has been migrated from ID-based to name-based location tracking.

### Database Schema Migration

**Version 1 (Old - Deprecated):**

```sql
CREATE TABLE location_order (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  spoolman_location_id INTEGER UNIQUE NOT NULL,  -- ❌ Doesn't work with Spoolman
  ordered_spool_ids TEXT NOT NULL DEFAULT '[]',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

**Version 2 (New - Current):**

```sql
CREATE TABLE location_order (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  location_name TEXT UNIQUE NOT NULL,  -- ✅ Uses location name as identifier
  ordered_spool_ids TEXT NOT NULL DEFAULT '[]',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### Changes Made

#### 1. Backend Database (`database.js`)

- **Schema**: Changed from `spoolman_location_id INTEGER` to `location_name TEXT`
- **Functions**: All CRUD operations now use location names instead of IDs
- **Migration**: Automatic migration to v2 runs on server startup
- **Compatibility**: Handles both string array and object formats from Spoolman

```javascript
// Before
export function getLocationOrder(locationId: number)

// After
export function getLocationOrder(locationName: string)
```

#### 2. Backend API (`proxy-server.js`)

- **Endpoints**: Updated to accept location names in URL parameters
- **Validation**: Changed from numeric ID validation to string name validation
- **Encoding**: Uses `encodeURIComponent` for location names with spaces

```javascript
// Before
GET /api/v1/location_manager/spool_order/:locationId
POST { locationId: number, spoolIds: number[] }

// After
GET /api/v1/location_manager/spool_order/:locationName
POST { locationName: string, spoolIds: number[] }
```

#### 3. Frontend Service (`src/providers/location-order.ts`)

- **Type Definitions**: Changed from `Record<number, number[]>` to `Record<string, number[]>`
- **Function Signatures**: Updated all functions to use `locationName: string`
- **URL Encoding**: Added proper encoding for location names in URLs

#### 4. Frontend UI (`src/pages/locations/index.tsx`)

- **State Management**: Changed order tracking from ID-based to name-based
- **Removed Mapping**: No longer needs `locationNameToId` conversion
- **Direct Access**: Uses location names directly to access order data

```typescript
// Before
const [localSpoolOrder, setLocalSpoolOrder] = useState<Record<number, number[]>>({});
const locationId = locationNameToId[locationName];
const order = localSpoolOrder[locationId];

// After
const [localSpoolOrder, setLocalSpoolOrder] = useState<Record<string, number[]>>({});
const order = localSpoolOrder[locationName];
```

## Migration Process

### Automatic Migration

The migration runs automatically when you start the proxy server:

```bash
npm run proxy
```

**What happens:**

1. Database checks current schema version
2. If version < 2, applies migration
3. Drops old table structure
4. Creates new name-based schema
5. Syncs with Spoolman locations

**⚠️ Warning:** Migration to v2 is **not backward compatible**. Existing order data will be lost. This is acceptable since:

- Order data is separate from Spoolman's data
- Users can re-arrange spools after migration
- Location assignments in Spoolman are preserved

### Testing the Migration

1. **Start the backend:**

   ```bash
   npm run proxy
   ```

2. **Check migration logs:**

   ```
   [timestamp] 🔨 Migration 2: Migrating to name-based schema...
   [timestamp] ✅ Migration 2 complete - now using location names
   ```

3. **Verify database:**

   ```bash
   curl http://localhost:7913/api/v1/location_manager/stats
   ```

4. **Test with location names:**
   ```bash
   # URL-encode location name (spaces → %20)
   curl http://localhost:7913/api/v1/location_manager/spool_order/Printer%20room
   ```

## API Changes

### Before (ID-based)

```typescript
// Get order for location ID 1
await locationOrderService.getLocationOrder(1);

// Update order for location ID 1
await locationOrderService.updateLocationOrder(1, [101, 102, 103]);
```

### After (Name-based)

```typescript
// Get order for location named "Printer room"
await locationOrderService.getLocationOrder("Printer room");

// Update order for location named "Printer room"
await locationOrderService.updateLocationOrder("Printer room", [101, 102, 103]);
```

## Benefits

1. **Correctness**: Matches Spoolman's actual API format
2. **Simplicity**: No ID mapping needed in frontend
3. **Flexibility**: Handles both string arrays and objects from Spoolman
4. **Robustness**: Proper URL encoding for location names with spaces/special chars

## Rollback

If you need to rollback (not recommended):

1. Stop the backend server
2. Delete `spoolman-order.db`
3. Revert code to previous version
4. Restart backend

**Note:** You'll lose all custom spool ordering data.

## Status

✅ **Implementation Complete**  
✅ **TypeScript Errors Resolved**  
✅ **Database Migration Ready**  
⏳ **Awaiting Production Testing**

The system is now correctly aligned with Spoolman's location format and ready for use.
