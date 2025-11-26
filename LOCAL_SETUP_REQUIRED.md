# ⚠️ LOCAL SETUP REQUIRED

## Why Your Connection is Failing

You are currently viewing this app in the **preview environment** which runs over **HTTPS**.

Your Spoolman API runs on **HTTP** (not HTTPS).

**Browsers block this by design** - it's called "mixed content blocking."

---

## 🚫 What Doesn't Work

- ❌ Preview (HTTPS) → Spoolman HTTP API
- ❌ Preview (HTTPS) → Spoolman WS:// WebSocket
- ❌ Any HTTPS site → Your local HTTP services

This is a **browser security feature** that cannot be disabled or worked around.

---

## ✅ The Solution: Run Locally

This application **MUST** be run on your local machine to connect to your Spoolman instance.

### Step 1: Prerequisites

You need:

- Node.js installed (v18 or higher)
- pnpm installed (`npm install -g pnpm`)
- Git (to clone the repository)

### Step 2: Get the Project

```bash
# Download or clone the project to your machine
# If you have the files, navigate to the project folder
cd spoolman-manager

# If you need to clone from git (replace with your repo URL)
# git clone <your-repo-url>
# cd <project-folder>
```

### Step 3: Install Dependencies

```bash
pnpm install
```

### Step 4: Configure Environment

Create or edit `.env` file:

```env
VITE_SPOOLMAN_API_URL=http://192.168.8.228:7912/api/v1
VITE_SPOOLMAN_WS_URL=ws://192.168.8.228:7912/api/v1/ws
VITE_USE_MOCK_DATA=false
```

**Important:** Replace `192.168.8.228` with your actual Spoolman server IP if different.

### Step 5: Configure Spoolman CORS

Your Spoolman Docker container needs to allow requests from `localhost:5173`:

```bash
# Stop existing container
docker stop spoolman
docker rm spoolman

# Start with CORS enabled
docker run -d \
  -p 7912:8000 \
  -e CORS_ALLOWED_ORIGINS="http://localhost:5173" \
  --name spoolman \
  -v spoolman_data:/home/app/.local/share/spoolman \
  ghcr.io/donkie/spoolman:latest
```

**Or if using docker-compose.yml:**

```yaml
version: "3.8"

services:
  spoolman:
    image: ghcr.io/donkie/spoolman:latest
    container_name: spoolman
    ports:
      - "7912:8000"
    environment:
      - CORS_ALLOWED_ORIGINS=http://localhost:5173 # Add this line
    volumes:
      - spoolman_data:/home/app/.local/share/spoolman
    restart: unless-stopped

volumes:
  spoolman_data:
```

Then: `docker-compose down && docker-compose up -d`

### Step 6: Run Development Server

```bash
pnpm dev
```

You should see:

```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

### Step 7: Access the App

Open your browser and go to:

```
http://localhost:5173
```

**DO NOT use:**

- ❌ The preview URL (starts with https://)
- ❌ 127.0.0.1 (use localhost)
- ❌ Your IP address

**Use exactly:** `http://localhost:5173`

---

## ✅ Verify It's Working

Once running locally, you should see:

1. ✅ No CORS errors in browser console (F12)
2. ✅ Locations and spools load from your Spoolman API
3. ✅ WebSocket indicator shows "Connected" (green)
4. ✅ Drag and drop functionality works
5. ✅ Changes persist when you refresh the page

---

## 🐛 Troubleshooting

### "Cannot find module" errors

```bash
# Delete node_modules and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### "Port 5173 is already in use"

```bash
# Find and kill the process using port 5173
# On Linux/Mac:
lsof -ti:5173 | xargs kill -9

# On Windows:
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# Or change the port in vite.config.ts
```

### Still seeing CORS errors locally

```bash
# Verify Spoolman container has CORS configured
docker inspect spoolman | grep CORS

# Should show: "CORS_ALLOWED_ORIGINS=http://localhost:5173"

# Check browser console - make sure you're at http://localhost:5173
# NOT https:// and NOT 127.0.0.1
```

### "Failed to fetch" or "Network Error"

```bash
# Test API directly
curl http://192.168.8.228:7912/api/v1/health

# If this fails, Spoolman isn't reachable
# Check: docker ps | grep spoolman
# Check: docker logs spoolman
```

---

## 📚 Additional Resources

- **CORS_DIAGNOSIS.md** - Complete CORS troubleshooting guide
- **CORS_FIX.md** - Step-by-step CORS configuration
- **DOCKER_TROUBLESHOOTING.md** - Docker-specific issues
- **WEBSOCKET_TROUBLESHOOTING.md** - WebSocket connection issues

---

## 🎯 Quick Command Reference

```bash
# Check Spoolman is running
docker ps | grep spoolman

# View Spoolman logs
docker logs spoolman --tail 20

# Restart Spoolman with CORS
docker restart spoolman

# Start local dev server
pnpm dev

# Test API from command line
curl http://192.168.8.228:7912/api/v1/location
```

---

## ❓ Why Can't I Use the Preview?

The preview is designed for:

- ✅ Viewing the UI/UX
- ✅ Testing with mock data
- ✅ Sharing the interface with others
- ✅ Demonstrating functionality

The preview **cannot** connect to:

- ❌ Local HTTP APIs (your Spoolman)
- ❌ Local databases
- ❌ Any local services on your network

This is a **fundamental browser security restriction** that protects users from malicious websites.

**For real data connections: You must run locally.**

---

## 🚀 After Setup

Once you have it running locally, you can:

1. ✅ Drag spools between locations
2. ✅ Reorder spools within locations
3. ✅ Create, edit, and delete locations
4. ✅ See changes sync via WebSocket
5. ✅ All changes persist to your Spoolman database

The app is fully functional when run locally with proper CORS configuration!
