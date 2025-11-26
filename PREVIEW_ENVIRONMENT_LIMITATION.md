# ⚠️ Preview Environment Cannot Connect to Local Spoolman

## The Real Issue (Not CORS!)

**You're seeing this error:**

```
Failed to construct 'WebSocket': An insecure WebSocket connection may not be initiated from a page loaded over HTTPS.
```

**Root Cause:** This is **browser security (Mixed Content Blocking)**, NOT a CORS problem with Spoolman.

### Why This Happens

| Component                   | Protocol                           | Secure?            |
| --------------------------- | ---------------------------------- | ------------------ |
| **Preview Environment**     | `https://...preview.ai.refine.dev` | ✅ Secure (HTTPS)  |
| **Your Spoolman API**       | `http://192.168.8.228:7912`        | ❌ Insecure (HTTP) |
| **Your Spoolman WebSocket** | `ws://192.168.8.228:7912`          | ❌ Insecure (WS)   |

Browsers **block all insecure content** (HTTP/WS) from secure pages (HTTPS) for security reasons. This is **not configurable** - it's a fundamental browser security policy.

### Important: CORS is NOT the Problem

Even if you've correctly set `CORS_ALLOWED_ORIGINS` in your Spoolman container, the connection will fail because:

1. The browser blocks the connection **before** any HTTP request is made
2. CORS headers are only checked **after** a connection is established
3. Mixed content blocking happens **at the network layer**, before CORS

**Translation:** Setting CORS_ALLOWED_ORIGINS won't fix this issue when using the preview environment.

---

## ✅ Solution: Run Locally

This application **MUST run locally** on your machine to connect to your local Spoolman instance.

### Step 1: Set Up Local Environment

```bash
# If you haven't already cloned the project, download it
# (You may already have this if you're working with the code)

# Navigate to project directory
cd spoolman-drag-drop-manager

# Install dependencies (if not already done)
pnpm install
```

### Step 2: Configure Environment Variables

Make sure your `.env` file has:

```env
VITE_SPOOLMAN_API_URL=http://192.168.8.228:7912/api/v1
VITE_SPOOLMAN_WS_URL=ws://192.168.8.228:7912/api/v1/ws
VITE_USE_MOCK_DATA=false
```

### Step 3: Start Local Development Server

```bash
pnpm dev
```

**Output should show:**

```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.x.x:5173/
```

### Step 4: Access in Browser

**Open:** `http://localhost:5173` (note: **HTTP**, not HTTPS)

Now the connection works because:

- ✅ Page: `http://localhost:5173` (HTTP)
- ✅ API: `http://192.168.8.228:7912` (HTTP)
- ✅ WebSocket: `ws://192.168.8.228:7912` (WS)

All connections are insecure (HTTP/WS), so browsers allow them.

---

## About CORS (When Running Locally)

When you run locally, you **DO** need CORS configured on Spoolman because:

- `http://localhost:5173` (your app)
- `http://192.168.8.228:7912` (Spoolman API)

These are different origins (different host/port), so CORS applies.

### Configure CORS on Spoolman

#### Using Docker Run:

```bash
docker stop spoolman
docker rm spoolman

docker run -d \
  --name spoolman \
  -p 7912:8000 \
  -e CORS_ALLOWED_ORIGINS=http://localhost:5173 \
  -v spoolman_data:/home/app/.local/share/spoolman \
  ghcr.io/donkie/spoolman:latest
```

#### Using Docker Compose:

Edit `docker-compose.yml`:

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

Then restart:

```bash
docker-compose down
docker-compose up -d
```

### Verify CORS is Working

```bash
# Test API with CORS headers
curl -I http://192.168.8.228:7912/api/v1/health
```

Look for:

```
Access-Control-Allow-Origin: http://localhost:5173
```

---

## Testing Checklist

When running locally at `http://localhost:5173`, you should see:

- ✅ No security/mixed content errors in browser console
- ✅ Locations and spools load from API
- ✅ WebSocket status shows "Connected" (green indicator)
- ✅ Drag and drop operations work
- ✅ Changes persist to Spoolman API

---

## Why Preview Environment Exists

The preview environment is useful for:

- ✅ Testing UI/UX with mock data
- ✅ Demonstrating features without a Spoolman instance
- ✅ Sharing work-in-progress with others

But it **cannot** connect to local HTTP/WS services due to browser security.

---

## Alternative: Deploy Spoolman with HTTPS

If you want to use the preview environment (or any HTTPS deployment), you would need:

1. **HTTPS endpoint for Spoolman API** (https://...)
2. **WSS endpoint for WebSocket** (wss://...)

This requires:

- A domain name
- SSL certificate
- Reverse proxy (nginx/traefik)
- Exposing Spoolman to the internet (security considerations!)

**This is complex and not recommended** for most users. Running locally is simpler and more secure.

---

## TL;DR

**The Problem:**

- Preview = HTTPS
- Spoolman = HTTP/WS
- Browser blocks mixed content

**The Solution:**

1. Run locally: `pnpm dev`
2. Access at: `http://localhost:5173`
3. Configure CORS in Spoolman: `-e CORS_ALLOWED_ORIGINS=http://localhost:5173`
4. Restart Spoolman: `docker-compose down && docker-compose up -d`
5. Refresh browser

**Everything will work!** 🎉

---

## Still Having Issues?

After running locally, if you see errors:

### 1. WebSocket Still Not Connecting

Check browser console for errors. If you see CORS errors (not mixed content), verify:

```bash
docker exec spoolman env | grep CORS
# Should show: CORS_ALLOWED_ORIGINS=http://localhost:5173
```

### 2. API Requests Failing

Test API directly:

```bash
curl http://192.168.8.228:7912/api/v1/spool
```

If this fails, it's a network/firewall issue, not CORS.

### 3. "Network Error" or "ERR_CONNECTION_REFUSED"

Spoolman might not be running:

```bash
docker ps | grep spoolman
```

If not running:

```bash
docker start spoolman
```

---

## Summary

| Scenario                             | Works? | Why                            |
| ------------------------------------ | ------ | ------------------------------ |
| **Preview (HTTPS) → Local HTTP API** | ❌ No  | Browser mixed content blocking |
| **Local (HTTP) → Local HTTP API**    | ✅ Yes | Same security level            |
| **Deployed (HTTPS) → HTTPS API**     | ✅ Yes | Both secure                    |

**For local Spoolman, you must run the app locally.**
