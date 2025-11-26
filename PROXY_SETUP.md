# 🔧 CORS Proxy Setup Guide

## Why You Need This

Your Spoolman Docker container is **not sending CORS headers** even though you've set the `CORS_ALLOWED_ORIGINS` environment variable. This appears to be a Spoolman version issue or configuration bug.

**The Solution:** Use a local proxy server that adds CORS headers to all Spoolman API responses.

---

## Quick Setup (3 Steps)

### 1. Install Dependencies

```bash
# Install required packages for the proxy server
npm install express http-proxy-middleware cors
```

Or if using pnpm:

```bash
pnpm add express http-proxy-middleware cors
```

### 2. Start the Proxy Server

```bash
# Start the proxy (this will run on port 7913)
node proxy-server.js
```

You should see:

```
✅ CORS Proxy Server Running
==============================
📍 Proxy URL:     http://localhost:7913
🎯 Target:        http://192.168.8.228:7912
🔓 Allowed Origin: http://localhost:5173
```

**Keep this terminal window open** - the proxy needs to stay running.

### 3. Update Your .env File

Edit your `.env` file to use the proxy:

```env
# Point to the proxy instead of Spoolman directly
VITE_SPOOLMAN_API_URL=http://localhost:7913/api/v1
VITE_SPOOLMAN_WS_URL=ws://localhost:7913/api/v1/ws
VITE_USE_MOCK_DATA=false
```

### 4. Restart Your Dev Server

```bash
# Stop the dev server (Ctrl+C)
# Then start it again
pnpm dev
```

### 5. Test It Works

Open browser console at `http://localhost:5173` and run:

```javascript
fetch("http://localhost:7913/api/v1/location")
  .then((r) => r.json())
  .then((d) => console.log("✅ SUCCESS:", d))
  .catch((e) => console.error("❌ FAILED:", e));
```

You should see your locations data with **no CORS errors**! 🎉

---

## How It Works

```
Your Browser (localhost:5173)
    ↓
    ↓ HTTP Request with CORS headers
    ↓
Proxy Server (localhost:7913) ← Adds CORS headers
    ↓
    ↓ Forward request (no CORS needed, server-to-server)
    ↓
Spoolman API (192.168.8.228:7912)
```

The proxy:

- Receives requests from your app at `http://localhost:5173`
- Adds proper CORS headers (`Access-Control-Allow-Origin`, etc.)
- Forwards requests to Spoolman at `http://192.168.8.228:7912`
- Returns Spoolman's response with CORS headers added
- Supports both HTTP API and WebSocket connections

---

## Configuration Options

You can customize the proxy with environment variables:

```bash
# Change Spoolman host/port
SPOOLMAN_HOST=192.168.8.228 SPOOLMAN_PORT=7912 node proxy-server.js

# Use a different proxy port
PROXY_PORT=8080 node proxy-server.js

# Allow different origin
ALLOWED_ORIGIN=http://localhost:3000 node proxy-server.js

# Enable debug logging
DEBUG=1 node proxy-server.js
```

---

## Running in Production

### Option 1: Use PM2 (Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Start proxy with PM2
pm2 start proxy-server.js --name spoolman-proxy

# Make it start on system boot
pm2 startup
pm2 save

# View logs
pm2 logs spoolman-proxy

# Stop/restart
pm2 stop spoolman-proxy
pm2 restart spoolman-proxy
```

### Option 2: Create a systemd Service (Linux)

Create `/etc/systemd/system/spoolman-proxy.service`:

```ini
[Unit]
Description=Spoolman CORS Proxy
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/your/project
ExecStart=/usr/bin/node proxy-server.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable spoolman-proxy
sudo systemctl start spoolman-proxy
sudo systemctl status spoolman-proxy
```

### Option 3: Docker Container

Create `Dockerfile.proxy`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
RUN npm install express http-proxy-middleware cors

# Copy proxy server
COPY proxy-server.js .

# Expose port
EXPOSE 7913

# Run proxy
CMD ["node", "proxy-server.js"]
```

Build and run:

```bash
docker build -f Dockerfile.proxy -t spoolman-cors-proxy .

docker run -d \
  --name spoolman-cors-proxy \
  -p 7913:7913 \
  -e SPOOLMAN_HOST=192.168.8.228 \
  -e SPOOLMAN_PORT=7912 \
  --restart unless-stopped \
  spoolman-cors-proxy
```

---

## Troubleshooting

### Proxy won't start - "Cannot find module"

```bash
# Make sure dependencies are installed
npm install express http-proxy-middleware cors

# Or with pnpm
pnpm add express http-proxy-middleware cors
```

### "Error: listen EADDRINUSE"

Port 7913 is already in use. Either:

```bash
# Stop the process using port 7913
lsof -ti:7913 | xargs kill

# Or use a different port
PROXY_PORT=8080 node proxy-server.js
```

### Proxy running but still getting CORS errors

1. **Check your .env file** - make sure it points to the proxy:

   ```env
   VITE_SPOOLMAN_API_URL=http://localhost:7913/api/v1
   ```

2. **Restart dev server** after changing .env:

   ```bash
   # Ctrl+C then:
   pnpm dev
   ```

3. **Check proxy is running**:
   ```bash
   curl http://localhost:7913/health
   ```

### WebSocket connection failing

Make sure you're using the proxy for WebSocket too:

```env
VITE_SPOOLMAN_WS_URL=ws://localhost:7913/api/v1/ws
```

Test WebSocket through proxy:

```bash
# Install wscat if you don't have it
npm install -g wscat

# Test WebSocket connection
wscat -c ws://localhost:7913/api/v1/ws
```

---

## Testing the Proxy

### Test 1: Health Check

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

### Test 2: Check CORS Headers

```bash
curl -I http://localhost:7913/api/v1/location
```

Should include:

```
Access-Control-Allow-Origin: http://localhost:5173
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
```

### Test 3: Fetch Locations

```bash
curl http://localhost:7913/api/v1/location
```

Should return your locations data.

---

## Why Spoolman's CORS Isn't Working

**Possible reasons:**

1. **Spoolman version doesn't support CORS env var** - Older versions may not have this feature
2. **Bug in Spoolman's CORS implementation** - The env var might not be properly read
3. **FastAPI middleware issue** - CORS middleware might not be configured correctly in Spoolman
4. **Environment variable not being read** - Container might be using a different config method

**Recommended actions:**

1. **Update Spoolman to latest version:**

   ```bash
   docker pull ghcr.io/donkie/spoolman:latest
   docker-compose down && docker-compose up -d
   ```

2. **Check Spoolman GitHub issues:**

   - Search: https://github.com/Donkie/Spoolman/issues?q=cors
   - Open a new issue if CORS env var doesn't work

3. **Check Spoolman logs for CORS-related messages:**

   ```bash
   docker logs spoolman | grep -i cors
   ```

4. **Use the proxy as a reliable workaround** while waiting for a fix

---

## Alternative: nginx Reverse Proxy

If you prefer nginx over Node.js:

```nginx
server {
    listen 7913;

    location /api/ {
        # Add CORS headers
        add_header Access-Control-Allow-Origin "http://localhost:5173" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type" always;

        if ($request_method = OPTIONS) {
            return 204;
        }

        # Proxy to Spoolman
        proxy_pass http://192.168.8.228:7912/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

---

## Summary

**TL;DR:**

1. Install: `npm install express http-proxy-middleware cors`
2. Start proxy: `node proxy-server.js`
3. Update `.env`: Point to `http://localhost:7913/api/v1`
4. Restart dev server: `pnpm dev`
5. ✅ CORS errors gone!

The proxy is a **reliable workaround** until Spoolman's CORS configuration is fixed.
