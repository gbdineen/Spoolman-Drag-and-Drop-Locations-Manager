# 🔬 Spoolman CORS Issue Investigation

## Problem Statement

**Issue:** Spoolman Docker container is NOT sending CORS headers despite having `CORS_ALLOWED_ORIGINS=http://localhost:5173` environment variable set.

**Evidence:**

```bash
curl -I http://192.168.8.228:7912/api/v1/location
```

**Response (missing CORS headers):**

```
< HTTP/1.1 200 OK
< date: Tue, 25 Nov 2025 05:39:27 GMT
< server: uvicorn
< content-length: 20
< content-type: application/json
```

**Expected (but not present):**

```
< Access-Control-Allow-Origin: http://localhost:5173
```

---

## Verified Setup

✅ Container has environment variable set (verified with `docker inspect` or `docker exec spoolman env`)  
✅ Container was recreated with `docker-compose down && docker-compose up -d`  
✅ API is accessible and returning data  
✅ Accessing from `http://localhost:5173` (local development, not preview)  
❌ CORS headers are NOT present in response

---

## Possible Root Causes

### 1. Spoolman Version Does Not Support CORS Environment Variable

**Hypothesis:** Older versions of Spoolman may not have CORS support, or the environment variable name might have changed.

**Investigation Steps:**

```bash
# Check Spoolman version
docker exec spoolman cat /app/version.txt 2>/dev/null || echo "Version file not found"

# Check container image tag
docker inspect spoolman | grep -i "Image"

# Check when the image was built
docker inspect ghcr.io/donkie/spoolman:latest | grep -i "Created"

# Pull latest version
docker pull ghcr.io/donkie/spoolman:latest
docker-compose down && docker-compose up -d
```

**Known Info:** Spoolman is a FastAPI/Python application using Uvicorn server. CORS is typically configured in FastAPI applications via middleware.

---

### 2. Wrong Environment Variable Name

**Hypothesis:** The environment variable might be named differently or have a specific format requirement.

**Possible alternatives to try:**

```yaml
environment:
  # Try different variations
  - CORS_ALLOWED_ORIGINS=http://localhost:5173
  - CORS_ORIGINS=http://localhost:5173
  - ALLOWED_ORIGINS=http://localhost:5173
  - SPOOLMAN_CORS_ALLOWED_ORIGINS=http://localhost:5173

  # Try with wildcard (TESTING ONLY)
  - CORS_ALLOWED_ORIGINS=*
```

**Check Spoolman source code/documentation:**

- GitHub: https://github.com/Donkie/Spoolman
- Look for CORS configuration in the codebase
- Check if there's a configuration file instead of environment variable

---

### 3. CORS Configuration Requires Additional Settings

**Hypothesis:** Spoolman might need additional CORS-related environment variables.

**Try:**

```yaml
environment:
  - CORS_ALLOWED_ORIGINS=http://localhost:5173
  - CORS_ALLOW_CREDENTIALS=true
  - CORS_ALLOW_METHODS=GET,POST,PUT,DELETE,PATCH,OPTIONS
  - CORS_ALLOW_HEADERS=*
```

---

### 4. Spoolman Requires Configuration File

**Hypothesis:** CORS might be configured via a config file, not environment variables.

**Investigation:**

```bash
# Check for configuration files in container
docker exec spoolman find /app -name "*.conf" -o -name "*.ini" -o -name "*.yaml" -o -name "*.json" 2>/dev/null

# Check for .env files
docker exec spoolman find /home/app -name ".env*" 2>/dev/null

# Check Spoolman documentation for config file location
```

---

## Workaround Solutions

### Solution 1: Local Reverse Proxy with CORS

Set up a local proxy that adds CORS headers. This is the most reliable workaround.

#### Option A: Using Node.js/Express Proxy

Create `proxy-server.js`:

```javascript
const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const cors = require("cors");

const app = express();

// Enable CORS for all routes
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);

// Proxy API requests to Spoolman
app.use(
  "/api",
  createProxyMiddleware({
    target: "http://192.168.8.228:7912",
    changeOrigin: true,
    ws: true, // Enable WebSocket proxying
  }),
);

const PORT = 7913;
app.listen(PORT, () => {
  console.log(`✅ CORS Proxy running on http://localhost:${PORT}`);
  console.log(`   Proxying to: http://192.168.8.228:7912`);
  console.log(`   Update .env to use: http://localhost:${PORT}/api/v1`);
});
```

**Setup:**

```bash
# Install dependencies
npm install express http-proxy-middleware cors

# Run proxy
node proxy-server.js
```

**Update `.env`:**

```env
VITE_SPOOLMAN_API_URL=http://localhost:7913/api/v1
VITE_SPOOLMAN_WS_URL=ws://localhost:7913/api/v1/ws
VITE_USE_MOCK_DATA=false
```

#### Option B: Using CORS Anywhere

```bash
# Clone cors-anywhere
git clone https://github.com/Rob--W/cors-anywhere.git
cd cors-anywhere
npm install

# Run proxy
PORT=7913 node server.js
```

**Update `.env`:**

```env
VITE_SPOOLMAN_API_URL=http://localhost:7913/http://192.168.8.228:7912/api/v1
VITE_SPOOLMAN_WS_URL=ws://192.168.8.228:7912/api/v1/ws
VITE_USE_MOCK_DATA=false
```

#### Option C: Using nginx Reverse Proxy

Create `nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    server {
        listen 7913;

        location /api/ {
            # Add CORS headers
            add_header Access-Control-Allow-Origin "http://localhost:5173" always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
            add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;
            add_header Access-Control-Allow-Credentials "true" always;

            # Handle preflight requests
            if ($request_method = OPTIONS) {
                return 204;
            }

            # Proxy to Spoolman
            proxy_pass http://192.168.8.228:7912/api/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }
}
```

**Run with Docker:**

```bash
docker run -d \
  --name spoolman-cors-proxy \
  -p 7913:7913 \
  -v $(pwd)/nginx.conf:/etc/nginx/nginx.conf:ro \
  nginx:alpine
```

---

### Solution 2: Browser Extension (Development Only)

**⚠️ NOT RECOMMENDED FOR PRODUCTION**

Install a CORS browser extension:

- Chrome: "CORS Unblock" or "Allow CORS"
- Firefox: "CORS Everywhere"

Enable the extension and it will inject CORS headers client-side.

**Downsides:**

- Only works on your development machine
- Security risk if left enabled
- Not a real solution

---

### Solution 3: Modify Spoolman Source Code

**For advanced users:**

1. Clone Spoolman repository
2. Modify CORS configuration in the FastAPI application
3. Build custom Docker image
4. Use your custom image

**This requires maintaining a fork and is not recommended unless you're comfortable with Python/FastAPI.**

---

## Recommended Action Plan

### Immediate: Use Proxy Solution

The most reliable workaround is to set up a local reverse proxy that adds CORS headers. The Node.js Express proxy (Solution 1A) is the easiest to set up and maintain.

### Steps:

1. **Create the proxy server** (see Solution 1A above)
2. **Update `.env` file** to point to proxy URL
3. **Restart dev server** (`pnpm dev`)
4. **Test in browser** at `http://localhost:5173`

### Long-term: Contact Spoolman Maintainers

1. **Check Spoolman GitHub Issues:** Search for existing CORS-related issues
2. **Check Spoolman Documentation:** Look for official CORS configuration docs
3. **Open GitHub Issue:** If CORS environment variable should work but doesn't, report it
4. **Check Discord/Community:** Spoolman might have a community chat where you can ask

---

## Testing Commands

After implementing proxy solution:

```bash
# Test proxy is running
curl -I http://localhost:7913/api/v1/health

# Should now see CORS headers:
# Access-Control-Allow-Origin: http://localhost:5173

# Test WebSocket through proxy
curl --include \
     --no-buffer \
     --header "Connection: Upgrade" \
     --header "Upgrade: websocket" \
     --header "Host: localhost:7913" \
     --header "Origin: http://localhost:5173" \
     --header "Sec-WebSocket-Key: SGVsbG8sIHdvcmxkIQ==" \
     --header "Sec-WebSocket-Version: 13" \
     http://localhost:7913/api/v1/ws
```

---

## Additional Resources

- **Spoolman GitHub:** https://github.com/Donkie/Spoolman
- **FastAPI CORS Documentation:** https://fastapi.tiangolo.com/tutorial/cors/
- **CORS Explained:** https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS

---

## Status

- [ ] Check Spoolman version and update to latest
- [ ] Try alternative environment variable names
- [ ] Check Spoolman GitHub for CORS documentation
- [ ] Implement proxy solution if Spoolman CORS cannot be fixed
- [ ] Test proxy with both REST API and WebSocket
- [ ] Update project documentation with working solution

---

## Next Steps

**User should:**

1. Try updating Spoolman to the absolute latest version
2. Check Spoolman GitHub issues/documentation for CORS configuration
3. If no solution found in Spoolman docs, implement the Node.js proxy (recommended)
4. Report findings back so we can document the working solution

**We can help:**

- Implement the proxy server solution
- Create automated setup scripts
- Update the project to work with the proxy
- Document the final working configuration
