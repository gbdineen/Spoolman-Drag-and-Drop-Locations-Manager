# 🔍 CORS & Connection Diagnosis Guide

## ⚠️ CRITICAL: Preview vs Local Development

### The Problem You're Experiencing

You're seeing: **"Failed to load data from Spoolman API. Please check your connection."**

**Root Cause:** You're testing in the **preview environment** which runs over **HTTPS**, but your Spoolman API runs on **HTTP**.

Browsers **block mixed content** for security:

- ❌ HTTPS page → HTTP API = **BLOCKED**
- ❌ HTTPS page → WS:// WebSocket = **BLOCKED**
- ✅ HTTP page → HTTP API = **ALLOWED**
- ✅ HTTP page → WS:// WebSocket = **ALLOWED**

### ✅ Solution: Run Locally

**This app MUST be run locally to connect to your Spoolman instance:**

```bash
# Clone/download your project
cd your-project

# Install dependencies (if not already done)
pnpm install

# Start local development server
pnpm dev
```

Then access at: **http://localhost:5173** (NOT the preview URL)

---

## 🔧 Step-by-Step CORS Troubleshooting

### Step 1: Verify Spoolman is Running

```bash
# Check container is running
docker ps | grep spoolman

# Expected output: You should see a line with "spoolman" and port 7912:8000
```

### Step 2: Test API Without CORS (Direct Access)

```bash
# Test health endpoint
curl http://192.168.8.228:7912/api/v1/health

# Test locations endpoint
curl http://192.168.8.228:7912/api/v1/location

# Test spools endpoint
curl http://192.168.8.228:7912/api/v1/spool
```

**Expected:** You should see JSON responses. If these fail, Spoolman isn't accessible (network issue, not CORS).

### Step 3: Check CORS Headers

```bash
# Check if CORS headers are present
curl -I http://192.168.8.228:7912/api/v1/health
```

**Look for these headers in the response:**

```
Access-Control-Allow-Origin: http://localhost:5173
```

If you **don't see** this header, Spoolman isn't configured with CORS enabled.

### Step 4: Check Spoolman Configuration

```bash
# Check environment variables in running container
docker inspect spoolman | grep -A 20 "Env"
```

**Look for:**

```json
"CORS_ALLOWED_ORIGINS=http://localhost:5173"
```

If it's **not there**, the environment variable wasn't set properly.

### Step 5: Check Spoolman Logs

```bash
# View recent logs
docker logs spoolman --tail 50

# Follow logs in real-time
docker logs spoolman -f
```

Look for:

- ✅ Startup messages showing Spoolman initialized
- ❌ Any error messages
- ✅ CORS configuration messages (if any)

---

## 🐳 Docker Configuration Check

### If Using docker run

Your command should look like this:

```bash
docker run -d \
  -p 7912:8000 \
  -e CORS_ALLOWED_ORIGINS="http://localhost:5173" \
  --name spoolman \
  -v spoolman_data:/home/app/.local/share/spoolman \
  ghcr.io/donkie/spoolman:latest
```

### If Using docker-compose.yml

Your file should have:

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

**Then restart:**

```bash
docker-compose down
docker-compose up -d
```

---

## 🧪 Browser-Based Testing

### Test 1: API from Browser Console

1. Run app locally: `pnpm dev`
2. Open browser at http://localhost:5173
3. Open Developer Console (F12)
4. Run:

```javascript
// Test API fetch
fetch("http://192.168.8.228:7912/api/v1/location")
  .then((r) => r.json())
  .then((data) => console.log("✅ Locations:", data))
  .catch((err) => console.error("❌ Error:", err));

// Test spools
fetch("http://192.168.8.228:7912/api/v1/spool")
  .then((r) => r.json())
  .then((data) => console.log("✅ Spools:", data))
  .catch((err) => console.error("❌ Error:", err));
```

### Test 2: WebSocket from Browser Console

```javascript
const ws = new WebSocket("ws://192.168.8.228:7912/api/v1/ws");

ws.onopen = () => console.log("✅ WebSocket Connected!");
ws.onerror = (e) => console.error("❌ WebSocket Error:", e);
ws.onclose = (e) => console.log("🔌 WebSocket Closed:", e.code, e.reason);
ws.onmessage = (e) => console.log("📨 Message:", e.data);
```

---

## 🔍 Common Issues & Solutions

### Issue 1: "No CORS Headers"

**Symptom:** `curl -I` shows no `Access-Control-Allow-Origin` header

**Solution:**

```bash
# Stop container
docker stop spoolman
docker rm spoolman

# Recreate with CORS
docker run -d \
  -p 7912:8000 \
  -e CORS_ALLOWED_ORIGINS="http://localhost:5173" \
  --name spoolman \
  -v spoolman_data:/home/app/.local/share/spoolman \
  ghcr.io/donkie/spoolman:latest

# Verify env var was set
docker inspect spoolman | grep CORS
```

### Issue 2: "Connection Refused"

**Symptom:** `curl: (7) Failed to connect`

**Possible Causes:**

- Spoolman container not running
- Wrong IP address
- Firewall blocking connection
- Container not exposing port correctly

**Solution:**

```bash
# Check container status
docker ps -a | grep spoolman

# Check if port is exposed
docker port spoolman

# Test from same machine as Docker
curl http://localhost:7912/api/v1/health

# If that works but IP doesn't, it's a network/firewall issue
```

### Issue 3: "403 Forbidden / CORS Error in Browser"

**Symptom:** Browser shows CORS error even though headers are present

**Possible Causes:**

- CORS_ALLOWED_ORIGINS doesn't match your URL exactly
- Using wrong protocol (http vs https)
- Using wrong port

**Solution:**

```bash
# Check exact URL in your browser address bar
# If you see: http://localhost:5173

# Set CORS to match EXACTLY (no trailing slash):
docker run -d \
  -e CORS_ALLOWED_ORIGINS="http://localhost:5173" \
  ...

# NOT:
# "http://localhost:5173/"  ❌ (trailing slash)
# "http://127.0.0.1:5173"    ❌ (different hostname)
# "localhost:5173"           ❌ (missing protocol)
```

### Issue 4: "Mixed Content" (Preview Environment)

**Symptom:** Errors about "insecure WebSocket connection may not be initiated from a page loaded over HTTPS"

**This is YOUR current issue!**

**Solution:** **You MUST run locally.** The preview environment is HTTPS and cannot connect to HTTP/WS endpoints.

```bash
# Run locally instead:
pnpm dev

# Access at:
http://localhost:5173

# NOT the preview URL!
```

---

## 📋 Environment File Checklist

Your `.env` file should have:

```env
VITE_SPOOLMAN_API_URL=http://192.168.8.228:7912/api/v1
VITE_SPOOLMAN_WS_URL=ws://192.168.8.228:7912/api/v1/ws
VITE_USE_MOCK_DATA=false
```

**After changing `.env`:**

- Press `Ctrl+C` to stop dev server
- Run `pnpm dev` again
- Refresh browser

---

## ✅ Success Checklist

When everything is working, you should see:

1. ✅ No errors in browser console
2. ✅ Locations and spools load and display
3. ✅ WebSocket shows "Connected" (green indicator)
4. ✅ Drag and drop works
5. ✅ Changes persist after page refresh

---

## 🆘 Quick Diagnosis Script

Save this as `test-spoolman.sh`:

```bash
#!/bin/bash

echo "🔍 Spoolman Connection Diagnosis"
echo "================================"
echo ""

# Test 1: Docker container
echo "1️⃣ Checking Docker container..."
if docker ps | grep -q spoolman; then
    echo "   ✅ Spoolman container is running"
else
    echo "   ❌ Spoolman container is NOT running"
    echo "   Run: docker ps -a | grep spoolman"
fi
echo ""

# Test 2: API reachability
echo "2️⃣ Testing API reachability..."
if curl -s -o /dev/null -w "%{http_code}" http://192.168.8.228:7912/api/v1/health | grep -q "200"; then
    echo "   ✅ API is reachable"
else
    echo "   ❌ API is NOT reachable"
fi
echo ""

# Test 3: CORS headers
echo "3️⃣ Checking CORS headers..."
if curl -I -s http://192.168.8.228:7912/api/v1/health | grep -q "Access-Control-Allow-Origin"; then
    echo "   ✅ CORS headers present:"
    curl -I -s http://192.168.8.228:7912/api/v1/health | grep "Access-Control"
else
    echo "   ❌ CORS headers NOT found"
    echo "   Add environment variable: CORS_ALLOWED_ORIGINS=http://localhost:5173"
fi
echo ""

# Test 4: Environment variables
echo "4️⃣ Checking container environment..."
if docker inspect spoolman 2>/dev/null | grep -q "CORS_ALLOWED_ORIGINS"; then
    echo "   ✅ CORS environment variable set:"
    docker inspect spoolman | grep "CORS_ALLOWED_ORIGINS"
else
    echo "   ❌ CORS environment variable NOT set"
fi
echo ""

echo "================================"
echo "Diagnosis complete!"
```

Run with: `chmod +x test-spoolman.sh && ./test-spoolman.sh`

---

## 📞 Still Stuck?

If you've followed all steps and it still doesn't work:

1. Share output of: `docker logs spoolman --tail 50`
2. Share output of: `curl -I http://192.168.8.228:7912/api/v1/health`
3. Share your docker-compose.yml or docker run command
4. Confirm you're accessing at `http://localhost:5173` (not preview URL)
5. Share browser console errors (F12 → Console tab)

---

## 🎯 TL;DR - Quick Fix

```bash
# 1. Stop container
docker stop spoolman && docker rm spoolman

# 2. Recreate with CORS
docker run -d \
  -p 7912:8000 \
  -e CORS_ALLOWED_ORIGINS="http://localhost:5173" \
  --name spoolman \
  -v spoolman_data:/home/app/.local/share/spoolman \
  ghcr.io/donkie/spoolman:latest

# 3. Run app LOCALLY (not preview!)
pnpm dev

# 4. Access at http://localhost:5173
```

**Remember:** This app **cannot work in the preview environment** when connecting to a local HTTP API!
