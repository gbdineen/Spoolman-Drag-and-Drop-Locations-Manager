# WebSocket Troubleshooting Guide

## Issues Identified

### 1. Preview Environment: HTTPS/WSS Protocol Mismatch

**Error**: `Failed to construct 'WebSocket': An insecure WebSocket connection may not be initiated from a page loaded over HTTPS.`

**Cause**: The preview environment runs on HTTPS, but the WebSocket URL uses `ws://` (insecure). Browsers block mixed content for security.

**Solution**: Use `wss://` (secure WebSocket) when connecting from HTTPS pages, or run locally on HTTP.

### 2. Spoolman WebSocket: Connection Rejected with ASGI Errors

**Error in Spoolman logs**:

```
AssertionError
uvicorn.error INFO connection open
uvicorn.error INFO connection closed
uvicorn.error ERROR Exception in ASGI application
```

**Root Cause**: Our implementation is trying to **send** custom payload data to Spoolman's WebSocket, but Spoolman's WebSocket is designed as a **broadcast-only** service.

#### How Spoolman WebSocket Works:

1. **Client → REST API**: All data changes go through REST endpoints
2. **Spoolman → WebSocket**: Spoolman broadcasts change events to all connected clients
3. **Client ← WebSocket**: Clients listen for updates and refresh their data

#### What We Were Doing Wrong:

- Trying to send custom JSON payloads with location data via WebSocket
- Spoolman doesn't accept or process client-sent WebSocket messages
- This causes ASGI exceptions and connection rejection

## The Fix

### Correct WebSocket Pattern:

1. **Connect** to Spoolman WebSocket (listen-only mode)
2. **Make REST API calls** for all data changes (create, update, delete)
3. **Listen** for WebSocket broadcasts from Spoolman
4. **Refresh data** when broadcasts are received

### No Need to Send Data:

- REST API updates already notify Spoolman
- Spoolman broadcasts to all clients automatically
- We just need to listen and react

## Implementation Changes

### Before (Incorrect):

```typescript
// Trying to send custom payloads
const payload = { locations: { Location1: [1, 2, 3] } };
ws.send(JSON.stringify(payload)); // ❌ Causes errors
```

### After (Correct):

```typescript
// Just listen for Spoolman's broadcasts
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  // Refresh data when Spoolman notifies us of changes
  refetchData();
};
// Don't send anything! ✅
```

## Testing WebSocket Connection

### 1. Local Development (HTTP):

- URL: `ws://192.168.8.228:7912/api/v1/ws`
- Should work from `http://localhost:5173`
- Connection should stay open (just listening)

### 2. Preview/Production (HTTPS):

- Need reverse proxy with SSL for `wss://` support
- Or disable WebSocket in preview environment

## Expected Behavior

### When Working Correctly:

1. ✅ WebSocket connects and stays open
2. ✅ No ASGI errors in Spoolman logs
3. ✅ REST API calls update data successfully
4. ✅ WebSocket receives broadcast messages from Spoolman
5. ✅ UI refreshes when broadcasts received
6. ✅ Multi-client sync works automatically

### What You'll See in Logs:

```
[WebSocket] Connected successfully
[WebSocket] Message received: {...}
[WebSocket] Refreshing data due to external update
```

## Debugging Checklist

- [ ] WebSocket URL is correct (`ws://` for HTTP, `wss://` for HTTPS)
- [ ] Connection stays open (doesn't immediately close)
- [ ] No ASGI errors in Spoolman container logs
- [ ] REST API calls work independently
- [ ] WebSocket receives broadcasts after REST updates
- [ ] UI refreshes when broadcasts received

## Environment Variables

```env
# For local development (HTTP)
VITE_SPOOLMAN_WS_URL=ws://192.168.8.228:7912/api/v1/ws

# For production with SSL (HTTPS)
VITE_SPOOLMAN_WS_URL=wss://your-domain.com/api/v1/ws

# Disable WebSocket if not available
VITE_SPOOLMAN_WS_URL=
```
