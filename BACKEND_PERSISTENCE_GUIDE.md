# Backend Persistence System Guide

## Overview

The Spoolman Location Manager now includes a **backend persistence system** that stores custom spool ordering separately from Spoolman's database. This allows you to arrange spools within locations and have that order persist across sessions.

## Architecture

### Dual WebSocket Model

The system uses a **two-layer WebSocket architecture**:

1. **Frontend On-Demand WebSocket** (unchanged)

   - Connects ONLY after user actions (drag/drop, location changes)
   - Listens for single broadcast from Spoolman
   - Disconnects after 5 seconds or on message receipt
   - Efficient for user-initiated actions

2. **Backend Persistent WebSocket Monitor** (new)
   - Runs continuously on the proxy server
   - Monitors Spoolman for external changes (other clients, direct updates)
   - Notifies frontend via Server-Sent Events (SSE)
   - Handles automatic reconnection

### Data Separation

- **Spoolman Database**: Location assignments, spool metadata, filament info
- **Our SQLite Database**: Custom spool order within each location
- **Frontend**: Merges both sources for display

### Why This Approach?

Spoolman doesn't have built-in support for custom spool ordering within locations. Rather than modifying Spoolman, we:

- Use Spoolman's REST API for location assignments
- Store custom order in our own database
- Monitor Spoolman for external changes
- Merge data on the frontend

## Components

### 1. SQLite Database (`database.js`)

**Location:** `./database.js`

**Purpose:** Persistent storage for spool order data

**Schema:**

```sql
CREATE TABLE location_order (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  spoolman_location_id INTEGER UNIQUE NOT NULL,
  ordered_spool_ids TEXT NOT NULL DEFAULT '[]',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

**Key Features:**

- SQLite with WAL mode for better concurrency
- Migration system with schema versioning
- Auto-sync with Spoolman locations on startup
- JSON storage for ordered spool IDs

**API:**

```javascript
import {
  initializeDatabase,
  getAllLocationOrders,
  getLocationOrder,
  updateLocationOrder,
  deleteLocationOrder,
  initializeLocationsFromSpoolman,
  cleanupDeletedLocations,
  closeDatabase,
  getDatabaseStats,
} from "./database.js";
```

### 2. WebSocket Monitor (`spoolman-monitor.js`)

**Location:** `./spoolman-monitor.js`

**Purpose:** Persistent WebSocket connection to monitor Spoolman for external changes

**Key Features:**

- Automatic reconnection with exponential backoff
- Heartbeat monitoring (30-second interval)
- Multi-client support via registration system
- Change detection for spools and locations
- Server-Sent Events (SSE) for frontend notifications

**How It Works:**

1. Connects to Spoolman WebSocket on server startup
2. Listens for broadcasts (location changes, spool updates)
3. Detects what changed (added, deleted, moved spools)
4. Notifies all connected frontend clients via SSE
5. Handles disconnections and reconnects automatically

**API:**

```javascript
import {
  initializeSpoolmanMonitor,
  registerFrontendClient,
  getMonitorStatus,
  reconnectMonitor,
  closeMonitor,
} from "./spoolman-monitor.js";
```

### 3. Proxy Server (`proxy-server.js`)

**Location:** `./proxy-server.js`

**Purpose:** CORS proxy + backend API + WebSocket routing

**New Endpoints:**

#### Location Manager API

```
GET    /api/v1/location_manager/spool_order
       Returns: { locations: { [locationId]: [spoolId1, spoolId2, ...] } }

GET    /api/v1/location_manager/spool_order/:locationId
       Returns: { locationId: number, spoolIds: number[] }

POST   /api/v1/location_manager/update_spool_order
       Body: { locationId: number, spoolIds: number[] }
       Returns: { success: true, locationId, spoolCount }

DELETE /api/v1/location_manager/spool_order/:locationId
       Returns: { success: true, locationId }

POST   /api/v1/location_manager/sync
       Triggers sync with Spoolman locations
       Returns: { success: true, stats }

GET    /api/v1/location_manager/stats
       Returns database statistics
```

#### Monitor API

```
GET    /api/v1/location_manager/monitor/status
       Returns: { connected, reconnectAttempts, lastMessageTime, clientCount }

POST   /api/v1/location_manager/monitor/reconnect
       Manually trigger monitor reconnection

GET    /api/v1/location_manager/events
       Server-Sent Events endpoint for real-time notifications
```

### 4. Frontend Services

#### Location Order Service (`src/providers/location-order.ts`)

**Purpose:** Interface with backend API

```typescript
import * as locationOrderService from "../../providers/location-order";

// Get all location orders
const orders = await locationOrderService.getAllLocationOrders();

// Update specific location
await locationOrderService.updateLocationOrder(locationId, spoolIds);

// Monitor status
const status = await locationOrderService.getMonitorStatus();
```

#### External Changes Hook (`src/hooks/useExternalChanges.ts`)

**Purpose:** Listen for external changes via SSE

```typescript
const { monitorStatus, lastChangeTime } = useExternalChanges(() => {
  // Callback when external change detected
  refetchData();
});
```

## Setup & Usage

### 1. Start the Backend Server

```bash
npm run proxy
```

This starts:

- CORS proxy on port 7913
- SQLite database initialization
- Persistent WebSocket monitor
- SSE server for real-time notifications
- REST API endpoints

### 2. Configure Environment

Update your `.env` file:

```bash
VITE_SPOOLMAN_API_URL=http://localhost:7913/api/v1
VITE_SPOOLMAN_WS_URL=ws://localhost:7913/api/v1/ws
```

### 3. Start the Frontend

```bash
pnpm dev
```

## Data Flow

### User Action (Drag/Drop Spool)

```
1. User drags spool to new location
2. Frontend updates Spoolman API (location assignment)
3. Frontend saves order to backend database
4. Frontend connects to Spoolman WebSocket (on-demand)
5. Spoolman broadcasts change
6. Frontend receives broadcast and refreshes data
7. Frontend disconnects WebSocket
```

### External Change (Other Client)

```
1. Another client updates Spoolman
2. Spoolman broadcasts change
3. Backend monitor receives broadcast
4. Monitor sends SSE notification to all frontend clients
5. Frontend receives SSE event
6. Frontend refreshes data from Spoolman + backend
7. UI updates with new data + preserved order
```

### Order Persistence

```
1. Frontend loads spools from Spoolman
2. Frontend loads order from backend database
3. Frontend merges:
   - Spoolman: which location each spool is in
   - Backend: order of spools within each location
4. New spools appear at end of list
5. Deleted spools removed from order
6. Location assignments always match Spoolman
```

## Database Management

### Location

Default: `./spoolman-order.db` in the project root

Override with environment variable:

```bash
DB_PATH=/path/to/custom/database.db npm run proxy
```

### Backup

```bash
cp spoolman-order.db spoolman-order.db.backup
```

### Reset Database

```bash
rm spoolman-order.db
npm run proxy  # Will recreate database
```

### Inspect Database

```bash
sqlite3 spoolman-order.db
sqlite> SELECT * FROM location_order;
sqlite> .schema
sqlite> .quit
```

## Monitoring & Debugging

### Check Backend Status

```bash
curl http://localhost:7913/health
```

Returns:

```json
{
  "status": "ok",
  "proxy": "Proxying to http://192.168.8.228:7912",
  "cors": "Allowing origin: http://localhost:5173",
  "websocket": "WebSocket proxy enabled",
  "database": {
    "locationCount": 5,
    "fileSizeKB": "16.00",
    "version": 1,
    "path": "/path/to/spoolman-order.db"
  }
}
```

### Check Monitor Status

```bash
curl http://localhost:7913/api/v1/location_manager/monitor/status
```

### Check Database Stats

```bash
curl http://localhost:7913/api/v1/location_manager/stats
```

### View Backend Logs

The proxy server logs include:

- 🔍 WebSocket monitor connections
- 📨 Spoolman broadcasts
- 📦 Database operations
- 📡 SSE client connections
- ⚠️ Errors and warnings

### Test SSE Connection

```bash
curl -N http://localhost:7913/api/v1/location_manager/events
```

You should see:

```
data: {"type":"connected","clientId":"sse-..."}

data: {"type":"monitor_status","connected":true}
```

## Troubleshooting

### Database Errors

**Problem:** `SQLITE_BUSY` or locking errors

**Solution:**

- WAL mode should prevent this
- Check file permissions
- Ensure only one proxy server instance is running

### Monitor Not Connecting

**Problem:** Backend monitor shows disconnected

**Solution:**

1. Check Spoolman is running: `curl http://192.168.8.228:7912/api/v1/health`
2. Verify WebSocket URL: `ws://192.168.8.228:7912/api/v1/`
3. Check proxy logs for connection errors
4. Manually reconnect: `curl -X POST http://localhost:7913/api/v1/location_manager/monitor/reconnect`

### SSE Not Working

**Problem:** Frontend not receiving external change notifications

**Solution:**

1. Check browser console for SSE connection errors
2. Verify CORS: SSE endpoint must allow your origin
3. Check proxy logs for SSE client connections
4. Test with curl (see above)

### Order Not Persisting

**Problem:** Spool order resets on page refresh

**Solution:**

1. Verify backend is running: `curl http://localhost:7913/health`
2. Check database file exists: `ls -la spoolman-order.db`
3. Check browser console for API errors
4. Verify VITE_USE_MOCK_DATA is false

### External Changes Not Detected

**Problem:** Changes from other clients not showing up

**Solution:**

1. Check monitor status (should be connected)
2. Verify SSE connection in browser network tab
3. Check backend logs for broadcasts
4. Test with direct Spoolman update

## Performance

### Database Size

- Minimal: ~16KB for typical setup
- Order data stored as JSON (compact)
- No indexing overhead for small datasets

### WebSocket Connections

- Frontend: On-demand (< 5 seconds per action)
- Backend: 1 persistent connection to Spoolman
- SSE: 1 connection per frontend client

### API Latency

- Database queries: < 1ms (in-memory with WAL)
- Network: Depends on Spoolman response time
- No performance impact on Spoolman

## Advanced Configuration

### Environment Variables

```bash
# Spoolman connection
SPOOLMAN_HOST=192.168.8.228
SPOOLMAN_PORT=7912

# Proxy server
PROXY_PORT=7913
ALLOWED_ORIGIN=http://localhost:5173

# Database
DB_PATH=./spoolman-order.db

# Debugging
DEBUG=1  # Enable verbose logging
```

### Custom Database Path

Useful for Docker deployments or shared storage:

```bash
DB_PATH=/data/spoolman-order.db npm run proxy
```

### Multiple Instances

To run multiple instances (e.g., development + production):

```bash
# Development
PROXY_PORT=7913 DB_PATH=./dev.db npm run proxy

# Production
PROXY_PORT=8913 DB_PATH=./prod.db npm run proxy
```

## Migration from Previous Version

If upgrading from a version without backend persistence:

1. **Start the backend**: `npm run proxy`
2. **Database auto-creates**: Initializes with Spoolman locations
3. **Arrange spools**: Drag/drop to set custom order
4. **Order persists**: No additional steps needed

Your existing Spoolman data is unchanged. The backend only adds order tracking.

## Limitations

### Current Limitations

1. **Single Spoolman Instance**: Backend monitors one Spoolman server
2. **No Multi-User Conflicts**: Last-write-wins for order updates
3. **No Undo/Redo**: Order changes are immediate

### Future Enhancements

- Conflict resolution for simultaneous order changes
- Undo/redo functionality
- Order history and audit log
- Multi-Spoolman support
- Order templates and presets

## Security

### Current Security

- **No Authentication**: Backend API is open
- **Local Network**: Designed for local use
- **CORS**: Restricts browser access to configured origin

### Recommendations

If exposing to network:

1. Add authentication middleware to proxy server
2. Use HTTPS (reverse proxy with nginx/caddy)
3. Restrict ALLOWED_ORIGIN to specific domains
4. Consider API rate limiting

## License

Same as Spoolman Location Manager project.
