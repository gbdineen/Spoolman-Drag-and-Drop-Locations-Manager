# WebSocket Reconnection Debugging Guide

## Recent Improvements (Latest Update)

The WebSocket implementation has been enhanced with comprehensive debugging and automatic reconnection features:

### New Features

1. **Heartbeat Monitoring**

   - Checks connection health every 30 seconds
   - Detects stale connections even when server doesn't send close events
   - Automatically forces reconnection if connection is dead

2. **Enhanced Logging**

   - All connection attempts logged with emoji indicators for easy scanning
   - Detailed status for each reconnection attempt
   - Heartbeat status showing time since last activity

3. **Manual Reconnect Button**

   - UI now shows a reconnect button when disconnected/error
   - Allows users to manually trigger reconnection attempts

4. **Better Connection State Detection**
   - Monitors WebSocket readyState continuously
   - Detects when proxy restarts and connection drops
   - Immediate reconnection scheduling on disconnect

## What You Should See in Logs

### Normal Connection Flow

```
[useWebSocket] Initializing WebSocket service for: ws://localhost:7913/api/v1/ws
[WebSocket] Service initialized with URL: ws://localhost:7913/api/v1/ws
[useWebSocket] Setting up WebSocket connection...
[useWebSocket] Calling service.connect()
[WebSocket] 🔌 Initiating connection to ws://localhost:7913/api/v1/ws
[WebSocket] ✅ Connection established successfully (listen-only mode)
[WebSocket] 💓 Starting heartbeat monitor
[WebSocket] 💓 Heartbeat check - Last activity: 2s ago
```

### When Proxy Restarts

```
[WebSocket] 🔌 Connection closed - Code: 1006, Reason: No reason provided, Clean: false
[WebSocket] 💓 Stopping heartbeat monitor
[useWebSocket] Status changed: disconnected
[WebSocket] ⏱️ Scheduling reconnect attempt 1/10 in 3s
[WebSocket] 🔄 Executing reconnect attempt 1/10
[WebSocket] 🔌 Initiating connection to ws://localhost:7913/api/v1/ws (Attempt 1/10)
```

### Heartbeat Detection of Stale Connection

```
[WebSocket] 💓 Heartbeat check - Last activity: 45s ago
[WebSocket] ⚠️ No activity for 45s - connection may be stale
[WebSocket] 🔄 Forcing reconnection due to stale connection
[WebSocket] 🔌 Connection closed - Code: 1006, Reason: , Clean: false
[WebSocket] ⏱️ Scheduling reconnect attempt 1/10 in 3s
```

### Connection Failure with Backoff

```
[WebSocket] 🔌 Initiating connection to ws://localhost:7913/api/v1/ws (Attempt 2/10)
[WebSocket] ⚠️ Error event fired: [Error details]
[WebSocket] 🔌 Connection closed - Code: 1006, Reason: No reason provided, Clean: false
[WebSocket] ⏱️ Scheduling reconnect attempt 3/10 in 7s
[WebSocket] 🔄 Executing reconnect attempt 3/10
```

## Testing the Reconnection

### Test Steps

1. **Start the proxy server:**

   ```bash
   npm run proxy
   ```

2. **Open the app locally (not preview):**

   ```bash
   pnpm dev
   ```

   Navigate to http://localhost:5173

3. **Open browser console** and filter for "WebSocket" to see connection logs

4. **Test automatic reconnection:**

   - Stop the proxy server (Ctrl+C)
   - Watch the logs - you should see:
     - Connection closed event
     - Reconnection scheduling
     - Reconnection attempts with increasing delays
   - Restart the proxy server
   - Connection should automatically re-establish

5. **Test manual reconnection:**

   - Stop the proxy server
   - Click the "Reconnect" button in the UI (appears next to WebSocket status)
   - Watch logs for manual reconnection attempt

6. **Test heartbeat detection:**
   - Keep connection open for 30+ seconds with no activity
   - Heartbeat logs should appear every 30 seconds
   - If you simulate a dead connection (kill proxy without closing socket), heartbeat should detect it within 30 seconds

## Log Legend

- 🔌 = Connection events (connect, disconnect)
- ✅ = Success
- ❌ = Error
- ⚠️ = Warning
- 💓 = Heartbeat check
- 🔄 = Reconnection attempt
- ⏱️ = Scheduling
- 📨 = Message received

## Configuration

Current settings in `src/providers/websocket.ts`:

- **Initial reconnect delay:** 3 seconds
- **Max reconnect delay:** 30 seconds (with exponential backoff)
- **Max reconnect attempts:** 10
- **Heartbeat interval:** 30 seconds
- **Heartbeat timeout:** 10 seconds
- **Stale connection threshold:** 40 seconds (heartbeat interval + timeout)

## Common Issues

### Issue: Logs show "Already connected or connecting"

**Cause:** WebSocket service is reusing existing connection
**Solution:** This is normal - service maintains single connection instance

### Issue: No reconnection attempts after proxy restart

**Cause:** Browser hasn't detected connection loss yet
**Solution:** Heartbeat monitor will detect within 30 seconds and force reconnect

### Issue: Connection closes but no disconnect event

**Cause:** TCP connection still open in browser's view
**Solution:** Heartbeat monitor detects stale connection and forces close/reconnect

### Issue: "Max reconnection attempts reached"

**Cause:** Server not available after 10 attempts
**Solution:** Click manual reconnect button or refresh page after server is back

## Debugging Tips

1. **Check WebSocket URL in .env:**

   ```
   VITE_SPOOLMAN_WS_URL=ws://localhost:7913/api/v1/ws
   ```

2. **Verify proxy is forwarding WebSocket:**

   - Check proxy-server.js logs for "WebSocket upgrade request received"
   - Should see "WebSocket connection established" for successful upgrade

3. **Browser DevTools Network Tab:**

   - Look for WebSocket connection (WS protocol)
   - Check connection status and frames

4. **React DevTools:**
   - Check useWebSocket hook state
   - Verify status changes are propagating

## What Changed

### Before

- No heartbeat monitoring
- Minimal logging
- Relied on browser's disconnect detection (slow)
- No manual reconnect option

### After

- Active heartbeat monitoring every 30 seconds
- Detailed emoji-tagged logging for easy debugging
- Proactive stale connection detection
- Manual reconnect button in UI
- Better connection state tracking
