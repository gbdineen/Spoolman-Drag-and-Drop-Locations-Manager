# Proxy Server Troubleshooting Guide

## Issue: Proxy returning HTML instead of JSON

If you're getting Spoolman's web UI HTML when calling API endpoints through the proxy, follow these debugging steps:

### 1. Test Direct Spoolman Connection

First, verify Spoolman is accessible directly:

```bash
# Test direct connection to Spoolman API
curl http://192.168.8.228:7912/api/v1/location

# Should return JSON like:
# [{"id":1,"name":"Location 1",...}]
```

If this returns HTML, your Spoolman API might not be running properly or the URL is incorrect.

### 2. Restart the Proxy Server

Stop the current proxy (Ctrl+C) and restart with debug logging:

```bash
DEBUG=1 npm run proxy
```

You should see output like:

```
✅ CORS Proxy Server Running
==============================
📍 Proxy URL:     http://localhost:7913
🎯 Target:        http://192.168.8.228:7912
...
```

### 3. Test the Proxy Health Endpoint

```bash
curl http://localhost:7913/health
```

Should return:

```json
{
  "status": "ok",
  "proxy": "Proxying to http://192.168.8.228:7912",
  "cors": "Allowing origin: http://localhost:5173"
}
```

### 4. Test the Proxy API Endpoint

```bash
curl http://localhost:7913/api/v1/location
```

Watch the proxy server console output. You should see:

```
[timestamp] GET /api/v1/location -> http://192.168.8.228:7912/api/v1/location
[timestamp] GET /api/v1/location <- 200 application/json
```

If you see `200 text/html` instead of `application/json`, the proxy is forwarding to the wrong path.

### 5. Common Issues

#### Issue: "Cannot reach Spoolman" error

**Cause:** Spoolman container is not running or not accessible.

**Solution:**

```bash
# Check if Spoolman is running
docker ps | grep spoolman

# Check Spoolman logs
docker logs spoolman
```

#### Issue: HTML response instead of JSON

**Cause:** Proxy is forwarding to Spoolman root (/) instead of the API path (/api/v1/location).

**Solution:** This should now be fixed with the updated proxy-server.js. Make sure you:

1. Stop the old proxy server
2. Restart with the updated code: `npm run proxy`
3. Check the console logs show correct forwarding

#### Issue: CORS errors in browser

**Cause:** Proxy CORS headers not working or app pointing to wrong URL.

**Solution:**

```bash
# Verify .env has correct proxy URL:
cat .env

# Should show:
# VITE_SPOOLMAN_API_URL=http://localhost:7913/api/v1
# VITE_USE_MOCK_DATA=false

# After updating .env, restart the dev server:
pnpm dev
```

### 6. Advanced Debugging

If issues persist, you can add more detailed logging:

```bash
# Set all environment variables for detailed output
DEBUG=1 SPOOLMAN_HOST=192.168.8.228 SPOOLMAN_PORT=7912 PROXY_PORT=7913 node proxy-server.js
```

Check the proxy logs for each request:

- **Request log**: Shows incoming request and target URL
- **Response log**: Shows status code and content-type
- Any errors will show the exact failure point

### 7. Verify Spoolman API Version

Make sure your Spoolman instance has the `/api/v1` endpoints:

```bash
# Check Spoolman info
curl http://192.168.8.228:7912/api/v1/info

# Should return version info
```

### 8. Alternative: Direct Connection with CORS

If the proxy continues to have issues, try the direct connection approach:

1. Stop Spoolman container
2. Restart with CORS enabled:
   ```bash
   docker run -d \
     --name spoolman \
     -p 7912:8000 \
     -e CORS_ALLOWED_ORIGINS="http://localhost:5173" \
     -v ./data:/home/app/.local/share/spoolman \
     ghcr.io/donkie/spoolman:latest
   ```
3. Update .env:
   ```
   VITE_SPOOLMAN_API_URL=http://192.168.8.228:7912/api/v1
   ```

## Quick Reset

If all else fails, complete reset:

```bash
# 1. Stop everything
# Ctrl+C on proxy server
# Ctrl+C on dev server

# 2. Verify Spoolman is running
curl http://192.168.8.228:7912/api/v1/location

# 3. Start fresh
npm run proxy
# In another terminal:
pnpm dev

# 4. Test in browser
# Open http://localhost:5173
# Check browser console for errors
```

## Expected Working Setup

When everything is working correctly:

1. **Spoolman**: Running on `http://192.168.8.228:7912`
2. **Proxy**: Running on `http://localhost:7913`, forwarding `/api/*` to Spoolman
3. **Dev Server**: Running on `http://localhost:5173`, making requests to proxy
4. **Browser**: Accessing dev server, no CORS errors

Request flow:

```
Browser → http://localhost:5173 (dev server)
        ↓
        Requests http://localhost:7913/api/v1/location (proxy)
        ↓
        Proxy forwards to http://192.168.8.228:7912/api/v1/location (Spoolman)
        ↓
        Proxy adds CORS headers and returns JSON to browser
```
