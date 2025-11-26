# 🔧 CORS & WebSocket Connection Fix

## Your Problem

You're seeing these errors:

- ❌ CORS errors when trying to fetch from `/api/v1/location` and `/api/v1/spool`
- ❌ WebSocket connection failing with error code 1006
- ❌ Browser console showing "Access-Control-Allow-Origin" errors

## Root Cause

Your Spoolman Docker container **is not configured to allow requests** from `http://localhost:5173`

By default, browsers block cross-origin requests for security. Since your app runs on `localhost:5173` and Spoolman runs on `192.168.8.228:7912`, they are different origins.

## The Fix (Choose One Method)

### Method 1: Docker Run Command (Quick & Easy)

If you started Spoolman with `docker run`:

```bash
# Stop and remove current container
docker stop spoolman
docker rm spoolman

# Recreate with CORS enabled
docker run -d \
  -p 7912:8000 \
  -e CORS_ALLOWED_ORIGINS="http://localhost:5173" \
  --name spoolman \
  -v spoolman_data:/home/app/.local/share/spoolman \
  ghcr.io/donkie/spoolman:latest
```

**Important:** The `-v spoolman_data:/home/app/.local/share/spoolman` preserves your existing data!

---

### Method 2: Docker Compose (Recommended for Long-Term)

If you're using `docker-compose.yml`:

1. **Edit your `docker-compose.yml` file** and add the environment variable:

```yaml
version: "3.8"

services:
  spoolman:
    image: ghcr.io/donkie/spoolman:latest
    container_name: spoolman
    ports:
      - "7912:8000"
    environment:
      - CORS_ALLOWED_ORIGINS=http://localhost:5173
    volumes:
      - spoolman_data:/home/app/.local/share/spoolman
    restart: unless-stopped

volumes:
  spoolman_data:
```

2. **Restart the container:**

```bash
docker-compose down
docker-compose up -d
```

---

### Method 3: Allow All Origins (Testing Only - Not Secure!)

If you just want to test quickly without security concerns:

```bash
docker stop spoolman
docker rm spoolman

docker run -d \
  -p 7912:8000 \
  -e CORS_ALLOWED_ORIGINS="*" \
  --name spoolman \
  -v spoolman_data:/home/app/.local/share/spoolman \
  ghcr.io/donkie/spoolman:latest
```

⚠️ **Warning:** This allows requests from ANY origin. Only use for testing!

---

## Verify the Fix

After restarting your Spoolman container:

### 1. Check Container is Running

```bash
docker ps | grep spoolman
```

You should see the container running.

### 2. Check Container Logs

```bash
docker logs spoolman --tail 20
```

Look for any startup errors.

### 3. Test API Directly

```bash
curl -I http://192.168.8.228:7912/api/v1/health
```

You should see headers including:

```
Access-Control-Allow-Origin: http://localhost:5173
```

### 4. Refresh Your Browser

1. Go to `http://localhost:5173` (make sure `pnpm dev` is running)
2. Open browser console (F12)
3. Look for these signs of success:
   - ✅ No red CORS errors
   - ✅ API requests to `/api/v1/location` and `/api/v1/spool` succeed
   - ✅ WebSocket status indicator shows "Connected" (green)

---

## Still Not Working?

### Check 1: Is the app running locally?

```bash
# Make sure you're running locally, not using preview
pnpm dev
```

Then access at `http://localhost:5173` (NOT the preview URL)

### Check 2: Is the API reachable?

```bash
# Test from your machine
curl http://192.168.8.228:7912/api/v1/spool
```

If this fails, the problem is network connectivity, not CORS.

### Check 3: Check Environment Variables

Make sure your `.env` file has:

```env
VITE_SPOOLMAN_API_URL=http://192.168.8.228:7912/api/v1
VITE_SPOOLMAN_WS_URL=ws://192.168.8.228:7912/api/v1/ws
VITE_USE_MOCK_DATA=false
```

After changing `.env`, restart the dev server:

```bash
# Press Ctrl+C to stop
pnpm dev
```

### Check 4: WebSocket Specifically

Test WebSocket in browser console:

```javascript
const ws = new WebSocket("ws://192.168.8.228:7912/api/v1/ws");
ws.onopen = () => console.log("✅ WebSocket Connected!");
ws.onerror = (e) => console.error("❌ WebSocket Error:", e);
ws.onclose = (e) => console.log("WebSocket Closed:", e.code, e.reason);
```

---

## Why This Happens

**CORS (Cross-Origin Resource Sharing)** is a browser security feature that prevents websites from making requests to different domains without permission.

Your situation:

- **Origin 1:** `http://localhost:5173` (your app)
- **Origin 2:** `http://192.168.8.228:7912` (Spoolman API)

These are **different origins** (different host/port), so the browser blocks the requests unless the server (Spoolman) explicitly allows it via CORS headers.

The `CORS_ALLOWED_ORIGINS` environment variable tells Spoolman to send the right headers that allow your app to make requests.

---

## Summary

**TL;DR:**

1. Stop Spoolman container
2. Restart it with `-e CORS_ALLOWED_ORIGINS="http://localhost:5173"`
3. Refresh your browser at `http://localhost:5173`
4. Everything should work now! 🎉

---

**Need more help?** Check `DOCKER_TROUBLESHOOTING.md` for additional troubleshooting steps.
