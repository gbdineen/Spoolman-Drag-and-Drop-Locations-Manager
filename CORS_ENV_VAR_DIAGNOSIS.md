# 🔍 CORS Environment Variable Not Being Applied - Diagnosis

## Your Specific Issue

You have:

- ✅ Set `CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5173/` in docker-compose.yml
- ✅ Restarted the container
- ❌ Still getting "no access control header" errors when curling
- ❌ CORS still not working

## Most Likely Causes

### 1. Docker Compose Didn't Rebuild the Container

**The Problem:** `docker-compose restart` does NOT reload environment variables from the compose file. It just restarts the existing container with its old configuration.

**The Fix:**

```bash
# Stop and REMOVE the container (this doesn't delete data)
docker-compose down

# Recreate containers with new environment variables
docker-compose up -d

# Verify the container was recreated (check "Created" time)
docker ps -a | grep spoolman
```

---

### 2. Wrong YAML Syntax in docker-compose.yml

**The Problem:** Environment variables need proper YAML formatting.

**Check your docker-compose.yml structure:**

```yaml
version: "3.8"

services:
  spoolman:
    image: ghcr.io/donkie/spoolman:latest
    container_name: spoolman
    ports:
      - "7912:8000"
    environment:
      # Option A: Single origin (RECOMMENDED - remove trailing slash)
      - CORS_ALLOWED_ORIGINS=http://localhost:5173

      # Option B: Multiple origins (use comma, no spaces)
      # - CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

      # Option C: YAML list format
      # CORS_ALLOWED_ORIGINS: "http://localhost:5173"
    volumes:
      - spoolman_data:/home/app/.local/share/spoolman
    restart: unless-stopped

volumes:
  spoolman_data:
```

**Common YAML mistakes:**

❌ Extra spaces after comma: `http://localhost:5173, http://localhost:5173/`  
❌ Quotes wrong: `CORS_ALLOWED_ORIGINS="http://localhost:5173"`  
❌ Wrong indentation (use 2 or 4 spaces consistently)  
❌ Mixing list format with dash format

✅ Correct: `- CORS_ALLOWED_ORIGINS=http://localhost:5173`  
✅ Correct: `CORS_ALLOWED_ORIGINS: http://localhost:5173`

---

### 3. Trailing Slash Issue

**The Problem:** `http://localhost:5173/` (with slash) and `http://localhost:5173` (without) are treated as DIFFERENT origins.

**The Fix:** Only use the URL **without** trailing slash:

```yaml
environment:
  - CORS_ALLOWED_ORIGINS=http://localhost:5173
```

❌ Don't use: `http://localhost:5173,http://localhost:5173/`  
✅ Use: `http://localhost:5173`

---

## 🔬 Step-by-Step Diagnostic

### Step 1: Verify Container Was Actually Recreated

```bash
# Check when container was created
docker inspect spoolman | grep -i created

# The timestamp should be AFTER you ran docker-compose down/up
# If it's old, the container wasn't recreated
```

### Step 2: Verify Environment Variable Inside Container

```bash
# Check environment variables INSIDE the running container
docker exec spoolman env | grep CORS
```

**Expected output:**

```
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

**If you see nothing:** The environment variable is NOT being passed to the container. Problem is in your docker-compose.yml syntax or you didn't recreate the container.

### Step 3: Test API Headers

```bash
# Test with curl and show ALL headers
curl -v http://192.168.8.228:7912/api/v1/health
```

**Look for in the response headers:**

```
< Access-Control-Allow-Origin: http://localhost:5173
```

**If missing:** The env var isn't being read by Spoolman.

### Step 4: Test CORS Preflight Request

```bash
# Test OPTIONS request (CORS preflight)
curl -X OPTIONS \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET" \
  -v http://192.168.8.228:7912/api/v1/location
```

**Should return:**

```
< Access-Control-Allow-Origin: http://localhost:5173
< Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
```

---

## 🔧 Complete Fix Procedure

Follow these steps **exactly**:

### 1. Edit docker-compose.yml

Make sure it looks like this (remove trailing slash):

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

### 2. Completely Recreate the Container

```bash
# Stop and remove containers (data is preserved in volume!)
docker-compose down

# Pull latest image (optional but recommended)
docker-compose pull

# Recreate and start containers
docker-compose up -d

# Watch logs for any errors
docker-compose logs -f spoolman
```

### 3. Verify Environment Variable Was Applied

```bash
# Check inside container
docker exec spoolman env | grep CORS

# Expected output:
# CORS_ALLOWED_ORIGINS=http://localhost:5173
```

### 4. Test CORS Headers

```bash
# Test with verbose curl
curl -v http://192.168.8.228:7912/api/v1/health 2>&1 | grep -i "access-control"

# Expected output:
# < Access-Control-Allow-Origin: http://localhost:5173
```

### 5. Test from Browser

```bash
# Make sure your dev server is running
pnpm dev
```

Then in browser at `http://localhost:5173`, open console (F12) and run:

```javascript
fetch("http://192.168.8.228:7912/api/v1/location")
  .then((r) => r.json())
  .then((d) => console.log("✅ SUCCESS:", d))
  .catch((e) => console.error("❌ FAILED:", e));
```

---

## 🐛 If Still Not Working

### Option A: Try Different CORS Format

Some Spoolman versions might need this format:

```yaml
environment:
  CORS_ALLOWED_ORIGINS: "http://localhost:5173"
```

Or this:

```yaml
environment:
  - "CORS_ALLOWED_ORIGINS=http://localhost:5173"
```

### Option B: Use Docker Run Instead (For Testing)

This bypasses docker-compose to verify if the problem is with compose file:

```bash
# Stop compose version
docker-compose down

# Start with docker run (this WILL work if docker-compose is the issue)
docker run -d \
  --name spoolman \
  -p 7912:8000 \
  -e CORS_ALLOWED_ORIGINS=http://localhost:5173 \
  -v spoolman_data:/home/app/.local/share/spoolman \
  ghcr.io/donkie/spoolman:latest

# Test
docker exec spoolman env | grep CORS
curl -v http://192.168.8.228:7912/api/v1/health 2>&1 | grep access-control
```

If `docker run` works but `docker-compose` doesn't, the problem is your docker-compose.yml syntax.

### Option C: Check Spoolman Version

```bash
# Check Spoolman version
docker exec spoolman cat /app/version.txt
# or
docker exec spoolman python --version
```

Very old versions of Spoolman might not support the CORS environment variable. Update to latest:

```bash
docker-compose pull
docker-compose up -d
```

---

## 🎯 Common Mistakes Summary

| Issue             | Wrong                                           | Right                                         |
| ----------------- | ----------------------------------------------- | --------------------------------------------- |
| Trailing slash    | `http://localhost:5173/`                        | `http://localhost:5173`                       |
| Not recreating    | `docker-compose restart`                        | `docker-compose down && docker-compose up -d` |
| Multiple values   | `http://localhost:5173, http://localhost:5173/` | `http://localhost:5173`                       |
| Wrong quotes      | `"CORS_ALLOWED_ORIGINS=..."` in dash format     | `- CORS_ALLOWED_ORIGINS=...` (no quotes)      |
| Wrong indentation | Mixed spaces/tabs                               | Consistent 2 or 4 spaces                      |

---

## 📊 Verification Checklist

Run these commands and share output if still having issues:

```bash
# 1. Check container environment
echo "=== Container Environment ==="
docker exec spoolman env | grep CORS

# 2. Check CORS headers
echo "=== CORS Headers ==="
curl -I http://192.168.8.228:7912/api/v1/health 2>&1 | grep -i access-control

# 3. Check container age
echo "=== Container Creation Time ==="
docker inspect spoolman | grep "Created"

# 4. Check compose file syntax
echo "=== Docker Compose Config ==="
docker-compose config | grep -A 5 environment

# 5. Check logs for errors
echo "=== Recent Logs ==="
docker logs spoolman --tail 20
```

---

## 💡 Quick Test Script

Save as `test-cors.sh`:

```bash
#!/bin/bash

echo "🔍 CORS Configuration Test"
echo "=========================="
echo ""

# Test 1: Environment variable in container
echo "1️⃣ Checking environment variable inside container..."
ENV_VAR=$(docker exec spoolman env 2>/dev/null | grep CORS)
if [ -n "$ENV_VAR" ]; then
    echo "   ✅ Found: $ENV_VAR"
else
    echo "   ❌ NOT FOUND - Environment variable is not set!"
    echo "   Fix: Run 'docker-compose down && docker-compose up -d'"
fi
echo ""

# Test 2: CORS headers in API response
echo "2️⃣ Checking CORS headers in API response..."
CORS_HEADER=$(curl -s -I http://192.168.8.228:7912/api/v1/health | grep -i "access-control-allow-origin")
if [ -n "$CORS_HEADER" ]; then
    echo "   ✅ Found: $CORS_HEADER"
else
    echo "   ❌ NOT FOUND - CORS headers are missing!"
    echo "   The environment variable might not be applied correctly."
fi
echo ""

# Test 3: Container creation time
echo "3️⃣ Checking when container was created..."
CREATED=$(docker inspect spoolman 2>/dev/null | grep "Created" | head -1)
echo "   $CREATED"
echo "   ⚠️  If this is old, run: docker-compose down && docker-compose up -d"
echo ""

echo "=========================="
if [ -n "$ENV_VAR" ] && [ -n "$CORS_HEADER" ]; then
    echo "✅ CORS is configured correctly!"
else
    echo "❌ CORS is NOT configured correctly."
    echo ""
    echo "Run these commands:"
    echo "  docker-compose down"
    echo "  docker-compose up -d"
    echo "  docker exec spoolman env | grep CORS"
fi
```

Run: `chmod +x test-cors.sh && ./test-cors.sh`

---

## 🎯 TL;DR - The Fix

```bash
# Edit docker-compose.yml - make sure it has:
# environment:
#   - CORS_ALLOWED_ORIGINS=http://localhost:5173
# (NO trailing slash, NO extra spaces)

# Then:
docker-compose down
docker-compose up -d

# Verify:
docker exec spoolman env | grep CORS
curl -I http://192.168.8.228:7912/api/v1/health | grep access-control

# If you see the CORS header, it's working!
# Refresh browser at http://localhost:5173
```

The key is: **`docker-compose restart` does NOT reload environment variables.** You MUST use `docker-compose down && docker-compose up -d`.
