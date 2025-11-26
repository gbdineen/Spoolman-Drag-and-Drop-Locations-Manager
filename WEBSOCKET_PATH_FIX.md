# WebSocket Path and Heartbeat Configuration Fix

## Issue

The WebSocket connection was closing after 60 seconds due to:

1. Incorrect WebSocket path: Using `/api/v1/ws` instead of `/api/v1/`
2. No proactive reconnection before Spoolman's 60-second idle timeout

## Root Cause

Spoolman WebSocket server:

- Path is `/api/v1/` (NOT `/api/v1/ws`)
- Closes connections after 60 seconds of inactivity
- Broadcast-only - does not send ping/pong frames
- Does not support bidirectional communication

## Solution

### 1. Corrected WebSocket URL

**Old Configuration:**

```
VITE_SPOOLMAN_WS_URL=ws://localhost:7913/api/v1/ws
```

**New Configuration:**

```
VITE_SPOOLMAN_WS_URL=ws://localhost:7913/api/v1/
```

### 2. Proactive Heartbeat Mechanism

Updated heartbeat configuration in `src/providers/websocket.ts`:

- **Heartbeat Interval:** 25 seconds (checks every 25s)
- **Idle Limit:** 55 seconds (reconnects before 60s timeout)
- **Logic:** Proactively reconnects if no activity detected for 55 seconds

This ensures the connection is refreshed before Spoolman's server-side timeout.

## Implementation Details

### Heartbeat Monitor

```typescript
private readonly HEARTBEAT_INTERVAL = 25000; // Check every 25 seconds
private readonly CONNECTION_IDLE_LIMIT = 55000; // Reconnect at 55 seconds
```

The heartbeat monitor:

1. Checks connection health every 25 seconds
2. Tracks time since last received message
3. If idle for 55+ seconds, proactively reconnects
4. Prevents server-initiated disconnection at 60 seconds

### Connection Flow

1. **Initial Connection:** WebSocket connects to `/api/v1/`
2. **Activity Tracking:** Updates `lastHeartbeat` timestamp on every received message
3. **Health Check:** Every 25 seconds, checks time since last activity
4. **Proactive Reconnect:** If idle > 55 seconds, closes and reconnects
5. **New Connection:** Fresh connection established before timeout

## Verification

Check the browser console for heartbeat logs:

```
[WebSocket] 💓 Starting heartbeat monitor
[WebSocket] 💓 Heartbeat check - Last activity: 10s ago
[WebSocket] 💓 Heartbeat check - Last activity: 35s ago
[WebSocket] ⚠️ No activity for 55s - approaching 60s timeout
[WebSocket] 🔄 Proactively reconnecting to prevent server timeout
[WebSocket] ✅ Connection established successfully (listen-only mode)
```

## Configuration

Update your `.env` file:

```bash
# Correct WebSocket path (ends with /)
VITE_SPOOLMAN_WS_URL=ws://localhost:7913/api/v1/

# Or for direct connection:
VITE_SPOOLMAN_WS_URL=ws://192.168.8.228:7912/api/v1/
```

## Testing

1. Start the application
2. Open browser console
3. Wait 60+ seconds without any Spoolman activity
4. Observe proactive reconnection at ~55 seconds
5. Connection remains stable indefinitely

## Related Documentation

- `WEBSOCKET_TROUBLESHOOTING.md` - General WebSocket debugging guide
- `WEBSOCKET_RECONNECTION_DEBUG.md` - Reconnection debugging guide
- `PROXY_SETUP.md` - Proxy server configuration for CORS
