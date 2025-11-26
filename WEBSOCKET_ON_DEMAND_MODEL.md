# WebSocket On-Demand Connection Model

## Overview

The WebSocket integration has been redesigned to use an **on-demand connection model** instead of a persistent connection. This aligns with Spoolman's broadcast-only WebSocket architecture and eliminates timeout issues.

## Architecture

### Previous Implementation (Persistent Connection)

- ❌ Maintained persistent WebSocket connection
- ❌ Heartbeat monitoring every 25 seconds
- ❌ Proactive reconnection at 55 seconds to prevent 60s timeout
- ❌ Complex connection lifecycle management
- ❌ Resource inefficient
- ❌ Timeout issues with Spoolman's 60-second idle timeout

### New Implementation (On-Demand Connection)

- ✅ Connects ONLY after API calls complete
- ✅ Listens for single broadcast from Spoolman
- ✅ Automatically disconnects after receiving message
- ✅ 5-second timeout if no broadcast received
- ✅ Simple connection lifecycle
- ✅ Resource efficient
- ✅ No timeout issues

## Connection Lifecycle

```
1. User performs action (move spool, create/edit/delete location)
   ↓
2. REST API call completes successfully
   ↓
3. Connect to WebSocket on-demand
   ↓
4. Listen for broadcast from Spoolman
   ↓
5a. Broadcast received → Refresh data → Disconnect
   OR
5b. 5-second timeout → Disconnect (optional: refresh data anyway)
```

## Implementation Details

### WebSocket Service (`src/providers/websocket.ts`)

The service provides a single method:

```typescript
connectOnDemand(
  onMessage: (message: WebSocketMessage) => void,
  onTimeout?: () => void
): () => void
```

**Features:**

- Opens connection
- Sets 5-second timeout
- Calls `onMessage` when broadcast received
- Calls `onTimeout` if timeout reached
- Automatically disconnects after message or timeout
- Returns cleanup function

### Hook (`src/hooks/useWebSocket.ts`)

```typescript
const { listenForBroadcast, isListening, isAvailable } = useWebSocket(wsUrl);
```

**API:**

- `listenForBroadcast(onMessage, onTimeout)` - Connect on-demand and listen
- `isListening` - Boolean indicating if actively listening
- `isAvailable` - Boolean indicating if WebSocket service is available

### Usage in Components

After each API mutation:

```typescript
updateSpool(/* ... */, {
  onSuccess: () => {
    // API call succeeded - listen for broadcast
    listenAfterApiCall();
  }
});
```

Where `listenAfterApiCall` is:

```typescript
const listenAfterApiCall = useCallback(() => {
  if (!isAvailable) return;

  listenForBroadcast(
    (message) => {
      // Broadcast received - refresh data
      handleRefresh();
    },
    () => {
      // Timeout - optionally refresh anyway
      handleRefresh();
    },
  );
}, [isAvailable, listenForBroadcast]);
```

## Triggered On-Demand After

1. **Move Spool Between Locations**

   - API: `PATCH /api/v1/spool/{id}` (update location)
   - Success → Connect → Listen → Refresh

2. **Reorder Spools** (when API endpoint available)

   - Currently local-only
   - When API ready: Success → Connect → Listen → Refresh

3. **Create Location**

   - API: `POST /api/v1/location`
   - Success → Connect → Listen → Refresh

4. **Edit Location**

   - API: `PATCH /api/v1/location/{id}`
   - Success → Connect → Listen → Refresh

5. **Delete Location**
   - API: `DELETE /api/v1/location/{id}`
   - Success → Connect → Listen → Refresh

## UI Indicator

**WebSocket Status Component** shows:

- **"Ready"** (gray) - Service available, not currently listening
- **"Listening"** (green, pulsing) - Actively connected and listening for broadcast

No manual reconnect button needed - connections are automatic after API calls.

## Benefits

### Resource Efficiency

- Connection exists only when needed (< 5 seconds per API call)
- No persistent connection overhead
- No heartbeat monitoring needed

### Reliability

- No 60-second timeout issues
- Simple lifecycle = fewer edge cases
- Aligned with Spoolman's broadcast-only design

### Multi-Client Sync

- Still receives broadcasts from other clients
- Any client's API call triggers Spoolman broadcast
- All listening clients receive update and refresh

## Debugging

Console logs show connection lifecycle:

```
[WebSocket] 🔧 On-demand service initialized with URL: ws://...
[LocationsPage] 🔌 API call completed - listening for broadcast confirmation...
[WebSocket] 🔌 Connecting on-demand to listen for broadcast...
[WebSocket] ✅ Connected (listening for single broadcast)
[WebSocket] 📨 Broadcast received from Spoolman: {...}
[LocationsPage] ✅ Broadcast received - refreshing data
[WebSocket] ✓ Message received - disconnecting
[WebSocket] 🔌 Connection closed - Code: 1000, Reason: ...
```

Or timeout scenario:

```
[WebSocket] 🔌 Connecting on-demand to listen for broadcast...
[WebSocket] ✅ Connected (listening for single broadcast)
[WebSocket] ⏱️ Timeout reached (5s) - no broadcast received, disconnecting
[LocationsPage] ⏱️ No broadcast received within timeout
[WebSocket] 🔌 Connection closed - Code: 1000, Reason: ...
```

## Configuration

WebSocket is controlled by environment variables:

```bash
# Enable/disable WebSocket (disabled for mock data)
VITE_USE_MOCK_DATA=false

# WebSocket URL (proxy or direct to Spoolman)
VITE_SPOOLMAN_WS_URL=ws://localhost:7913/api/v1/
```

**Important:** Path must be `/api/v1/` NOT `/api/v1/ws`

## Comparison with Previous Model

| Aspect               | Persistent Model        | On-Demand Model            |
| -------------------- | ----------------------- | -------------------------- |
| Connection Duration  | Always connected        | 0-5 seconds per API call   |
| Heartbeat            | Every 25s               | None needed                |
| Timeout Management   | Complex (55s proactive) | Simple (5s per connection) |
| Resource Usage       | High                    | Low                        |
| 60s Spoolman Timeout | Required workarounds    | Not an issue               |
| Code Complexity      | High                    | Low                        |
| Reliability          | Moderate                | High                       |

## Migration Notes

### Removed Components

- Persistent connection management
- Heartbeat interval/timeout logic
- Connection status tracking (connected/disconnected/error/connecting)
- Manual reconnect functionality
- Exponential backoff reconnection

### New Components

- `connectOnDemand()` method
- `isListening` state (simple boolean)
- Connection timeout (5 seconds)
- Automatic cleanup after message or timeout

### Breaking Changes

- `useWebSocket` hook API changed:
  - Removed: `status`, `onMessage`, `reconnect`, `isConnected`
  - Added: `listenForBroadcast`, `isListening`, `isAvailable`
- `WebSocketStatus` component props changed:
  - Old: `status: ConnectionStatus`, `onReconnect: () => void`
  - New: `isListening: boolean`, `onReconnect?: () => void` (optional)

## Testing

To test the on-demand model:

1. Start Spoolman and the app locally
2. Open browser console
3. Move a spool between locations
4. Watch console logs:
   - Should show API call completion
   - Should show WebSocket connection
   - Should show broadcast received (or timeout)
   - Should show disconnection
5. Verify data refreshes automatically
6. Repeat with location create/edit/delete operations

## Future Enhancements

- Add optional configurable timeout (currently fixed at 5 seconds)
- Add metrics tracking (connection count, success rate, timeout rate)
- Add fallback refresh if broadcast not received
- Consider batching if multiple API calls happen rapidly
