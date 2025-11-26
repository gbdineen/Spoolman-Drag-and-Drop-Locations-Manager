# WebSocket Proxy Fix

## Problem

The initial proxy implementation using only `http-proxy-middleware` was not properly handling WebSocket upgrade requests. When the client attempted to connect to `ws://localhost:7913/api/v1/ws`, the connection was not being forwarded to the Spoolman WebSocket endpoint.

## Root Cause

The `http-proxy-middleware` package's `upgrade` method doesn't work as expected when called directly from the Express server's `upgrade` event handler. The middleware needs to be initialized with proper WebSocket support using the underlying `http-proxy` library.

## Solution

The fix involved:

1. **Import `http-proxy` directly**: Create a dedicated WebSocket proxy instance using `httpProxy.createProxyServer()`.

2. **Separate WebSocket handling**: Handle HTTP requests through `http-proxy-middleware` and WebSocket upgrades through the dedicated `http-proxy` instance.

3. **Proper upgrade event handling**: In the server's `upgrade` event listener, use `wsProxy.ws(req, socket, head)` to properly forward the WebSocket connection.

## Implementation

```javascript
// Create a separate proxy instance for WebSocket handling
const wsProxy = httpProxy.createProxyServer({
  target: SPOOLMAN_URL,
  ws: true,
  changeOrigin: true,
});

// Handle WebSocket upgrade
server.on("upgrade", (req, socket, head) => {
  if (req.url.startsWith("/api/")) {
    // Use the dedicated WebSocket proxy
    wsProxy.ws(req, socket, head);
  } else {
    socket.destroy();
  }
});
```

## Testing

To verify the fix works:

1. **Start the proxy server**:

   ```bash
   npm run proxy
   ```

2. **Check the logs**: You should see WebSocket upgrade messages when the app connects:

   ```
   🔌 WebSocket upgrade request received: /api/v1/ws
   🔌 Upgrading WebSocket connection for /api/v1/ws
   🔌 WebSocket proxying: /api/v1/ws -> http://192.168.8.228:7912/api/v1/ws
   🔌 WebSocket connection established
   ```

3. **Verify in browser console**: The WebSocket should connect successfully without errors.

## Technical Details

### Why This Works

- **`http-proxy`** is the underlying library that `http-proxy-middleware` uses
- WebSocket upgrades require special handling at the HTTP server level
- The `upgrade` event fires before Express middleware, so we need direct access to the proxy
- Using `wsProxy.ws()` directly handles the protocol upgrade correctly

### Key Differences from Previous Implementation

| Previous                       | Fixed                                   |
| ------------------------------ | --------------------------------------- |
| Used `apiProxy.upgrade()`      | Uses `wsProxy.ws()` directly            |
| Single proxy for HTTP and WS   | Separate proxies for HTTP and WS        |
| Upgrade not properly forwarded | Upgrade correctly forwarded to Spoolman |

## Related Files

- `proxy-server.js`: Main proxy implementation
- `src/providers/websocket.ts`: WebSocket client implementation
- `.env`: Configuration for WebSocket URL

## Environment Variables

```bash
# Use the proxy for both HTTP and WebSocket
VITE_SPOOLMAN_API_URL=http://localhost:7913/api/v1
VITE_SPOOLMAN_WS_URL=ws://localhost:7913/api/v1/ws
```

## References

- [http-proxy documentation](https://github.com/http-party/node-http-proxy)
- [WebSocket upgrade process](https://developer.mozilla.org/en-US/docs/Web/HTTP/Protocol_upgrade_mechanism)
- [Express server upgrade event](https://nodejs.org/api/http.html#event-upgrade)
