# Docker & CORS Troubleshooting Guide

## ⚡ Quick Fix - If You're Getting CORS Errors RIGHT NOW

**Your Spoolman container needs to allow requests from `http://localhost:5173`**

Run these commands to fix it immediately:

```bash
# Stop and remove the existing container
docker stop spoolman
docker rm spoolman

# Recreate with CORS enabled for localhost:5173
docker run -d \
  -p 7912:8000 \
  -e CORS_ALLOWED_ORIGINS="http://localhost:5173" \
  --name spoolman \
  -v spoolman_data:/home/app/.local/share/spoolman \
  ghcr.io/donkie/spoolman:latest
```

**Or if using docker-compose, add this to your `docker-compose.yml`:**

```yaml
services:
  spoolman:
    image: ghcr.io/donkie/spoolman:latest
    ports:
      - "7912:8000"
    environment:
      - CORS_ALLOWED_ORIGINS=http://localhost:5173
    volumes:
      - spoolman_data:/home/app/.local/share/spoolman

volumes:
  spoolman_data:
```

Then run: `docker-compose down && docker-compose up -d`

**After restarting the container:**

1. Refresh your browser at `http://localhost:5173`
2. Check browser console (F12) - CORS errors should be gone
3. WebSocket status should show "Connected"

---

## 🚨 Important: Preview Environment Limitation

**The preview environment CANNOT access your local network (192.168.8.228)!**

You MUST run the application locally using `pnpm dev` and access it at `http://localhost:5173`

---

## Step 1: Verify Docker Container is Running

Run this command to check if your Spoolman container is running:

```bash
docker ps | grep spoolman
```

You should see output showing the container with port 7912 exposed.

---

## Step 2: Verify Port Binding

Check that port 7912 is properly exposed. Your `docker ps` output should show something like:

```
0.0.0.0:7912->8000/tcp
```

If you don't see this, your Docker container needs to be started with proper port mapping:

```bash
docker run -d \
  -p 7912:8000 \
  --name spoolman \
  ghcr.io/donkie/spoolman:latest
```

Or if using docker-compose, ensure your docker-compose.yml has:

```yaml
services:
  spoolman:
    image: ghcr.io/donkie/spoolman:latest
    ports:
      - "7912:8000"
```

---

## Step 3: Test API Access from Your Machine

Open a browser or use curl to test the API:

```bash
# Test API endpoint
curl http://192.168.8.228:7912/api/v1/health

# Or test in browser
# Open: http://192.168.8.228:7912/api/v1/health
```

You should see a response like `{"status":"ok"}` or similar.

If this fails:

- ✅ Check firewall rules on 192.168.8.228
- ✅ Verify the machine at 192.168.8.228 is reachable: `ping 192.168.8.228`
- ✅ Check Docker container logs: `docker logs spoolman`

---

## Step 4: Verify CORS Configuration in Spoolman

Spoolman needs to allow CORS from your local development server. Check if you're setting the CORS environment variable:

```bash
docker run -d \
  -p 7912:8000 \
  -e CORS_ALLOWED_ORIGINS="http://localhost:5173" \
  --name spoolman \
  ghcr.io/donkie/spoolman:latest
```

Or in docker-compose.yml:

```yaml
services:
  spoolman:
    image: ghcr.io/donkie/spoolman:latest
    ports:
      - "7912:8000"
    environment:
      - CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5173/
```

**After changing environment variables, restart the container:**

```bash
docker restart spoolman
```

---

## Step 5: Run the App Locally

Now run the application on your local machine:

```bash
# Install dependencies if you haven't
pnpm install

# Start the development server
pnpm dev
```

You should see output like:

```
  VITE v6.3.5  ready in XXX ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

---

## Step 6: Access via localhost:5173

**Open your browser and go to:**

```
http://localhost:5173
```

**DO NOT use the preview environment - it cannot access your local network!**

---

## Step 7: Verify Connection

Once the app loads at localhost:5173, check:

1. ✅ Browser console (F12) - should see no CORS errors
2. ✅ Network tab - API calls to 192.168.8.228:7912 should succeed
3. ✅ WebSocket status indicator in the app should show "Connected"

---

## Common Issues & Solutions

### Issue: "net::ERR_CONNECTION_REFUSED"

**Cause:** Docker container is not running or port is not exposed

**Solution:**

- Verify container is running: `docker ps`
- Check port binding includes 0.0.0.0:7912->8000/tcp
- Restart container with proper port mapping

---

### Issue: CORS Error "Access-Control-Allow-Origin"

**Cause:** Spoolman is not configured to allow requests from localhost:5173

**Solution:**

1. Stop container: `docker stop spoolman`
2. Remove container: `docker rm spoolman`
3. Recreate with CORS environment variable:
   ```bash
   docker run -d \
     -p 7912:8000 \
     -e CORS_ALLOWED_ORIGINS="http://localhost:5173" \
     --name spoolman \
     ghcr.io/donkie/spoolman:latest
   ```

**Alternative:** Set CORS to allow all origins (for testing only):

```bash
-e CORS_ALLOWED_ORIGINS="*"
```

---

### Issue: WebSocket Connection Failed

**Cause:** WebSocket endpoint not accessible or CORS issue

**Solution:**

1. Verify HTTP API works first
2. Check Spoolman logs: `docker logs spoolman`
3. Ensure CORS allows WebSocket connections
4. Try WebSocket test in browser console:
   ```javascript
   const ws = new WebSocket("ws://192.168.8.228:7912/api/v1/ws");
   ws.onopen = () => console.log("Connected!");
   ws.onerror = (e) => console.error("Error:", e);
   ```

---

### Issue: "Network Error" or Timeout

**Cause:** Cannot reach 192.168.8.228 from your machine

**Solution:**

1. Ping the server: `ping 192.168.8.228`
2. Check if you're on the same network
3. Check firewall rules on the Docker host machine
4. Try accessing from Docker host directly to verify: `curl localhost:7912/api/v1/health`

---

## Quick Checklist

Before running the app, verify:

- [ ] Docker container running: `docker ps | grep spoolman`
- [ ] Port 7912 exposed: Check docker ps output shows `0.0.0.0:7912->8000/tcp`
- [ ] API accessible: `curl http://192.168.8.228:7912/api/v1/health`
- [ ] CORS configured: Container started with `CORS_ALLOWED_ORIGINS` env var
- [ ] Running locally: `pnpm dev` (not using preview environment)
- [ ] Accessing correct URL: `http://localhost:5173` (not preview URL)

---

## Still Having Issues?

If you're still experiencing problems:

1. **Share Docker container logs:**

   ```bash
   docker logs spoolman --tail 50
   ```

2. **Share browser console errors:**

   - Open browser console (F12)
   - Copy any red error messages

3. **Verify network connectivity:**

   ```bash
   ping 192.168.8.228
   curl -v http://192.168.8.228:7912/api/v1/health
   ```

4. **Check if Spoolman is running correctly on the host:**
   - SSH into 192.168.8.228
   - Run: `curl localhost:7912/api/v1/health`
   - This verifies Spoolman is working locally on the Docker host
