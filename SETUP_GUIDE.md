# Spoolman Drag & Drop Location Manager - Setup Guide

This guide will help you run the application locally and connect it to your Spoolman instance.

## Prerequisites

Before you begin, make sure you have:

- **Node.js** (version 18 or higher) - [Download here](https://nodejs.org/)
- **pnpm** package manager - Install with: `npm install -g pnpm`
- **Spoolman** running on your local network at `http://192.168.8.228:7912`

---

## Step 1: Install Dependencies

1. **Clone or download** this project to your computer

2. **Open a terminal** in the project directory

3. **Install all dependencies** by running:

   ```bash
   pnpm install
   ```

   This will download all required packages. It may take a few minutes.

---

## Step 2: Configure Environment Variables

You need to tell the app where to find your Spoolman API.

1. **Copy the example environment file:**

   ```bash
   cp .env.example .env
   ```

   On Windows, use:

   ```cmd
   copy .env.example .env
   ```

2. **Open the `.env` file** in a text editor

3. **Update the values** to match your Spoolman instance:

   ```env
   # Your Spoolman API URL
   VITE_SPOOLMAN_API_URL=http://192.168.8.228:7912/api/v1

   # Your Spoolman WebSocket URL (for real-time updates)
   VITE_SPOOLMAN_WS_URL=ws://192.168.8.228:7912/api/v1/ws

   # Set to 'false' to use real API, 'true' for mock data
   VITE_USE_MOCK_DATA=false
   ```

   **Note:** If your Spoolman is running on a different IP address or port, update the URLs accordingly.

---

## Step 3: Run the Development Server

Start the app with:

```bash
pnpm dev
```

You should see output like:

```
  VITE v5.x.x  ready in XXX ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.x.x:5173/
```

**Open your browser** and navigate to `http://localhost:5173/`

---

## Step 4: Test the Interface

### ✅ Verify Connection

When the app loads, you should see:

- A **green WebSocket status indicator** in the top-right corner (shows "Connected")
- Your existing **locations** displayed as cards
- **Spools** organized within their locations
- An **"Unassigned Spools"** section at the top

### 🔧 Test Drag & Drop

1. **Move a spool between locations:**

   - Click and hold on a spool card
   - Drag it to another location
   - Drop it
   - ✅ The spool should appear in the new location
   - ✅ Check WebSocket status - it should briefly show "Sending..."
   - ✅ Changes should save to Spoolman API

2. **Reorder spools within a location:**

   - Drag a spool up or down within the same location
   - ✅ The order should change smoothly
   - ✅ Changes persist after refreshing the page

3. **Move spools to/from unassigned:**
   - Drag a spool from a location to the "Unassigned Spools" section
   - Drag it back to a location
   - ✅ Assignments should save correctly

### 🏷️ Test Location Management

1. **Create a new location:**

   - Click the "Create Location" button
   - Enter a name
   - Click "Create"
   - ✅ New location appears immediately

2. **Edit a location:**

   - Click the edit (pencil) icon on a location card
   - Change the name
   - Click "Save"
   - ✅ Name updates instantly

3. **Delete a location:**
   - Click the delete (trash) icon on a location card
   - Confirm the deletion
   - ✅ Location is removed
   - ✅ Its spools move to "Unassigned Spools"

### 🔄 Test Real-Time Sync

If you have Spoolman open in another browser tab or device:

1. Make a change in one tab (move a spool)
2. ✅ The other tab should automatically refresh and show the change
3. This happens because the WebSocket sends updates to all connected clients

---

## Troubleshooting

### ❌ "Connection Failed" or Red WebSocket Status

**Problem:** Can't connect to Spoolman API or WebSocket

**Solutions:**

- Verify Spoolman is running: Open `http://192.168.8.228:7912` in your browser
- Check your `.env` file has the correct IP address and port
- Make sure you're on the same network as the Spoolman server
- Check your firewall isn't blocking the connection
- Try the Spoolman API directly: `http://192.168.8.228:7912/api/v1/spool`

### ❌ "Port 5173 already in use"

**Problem:** Another app is using port 5173

**Solution:**

```bash
# Kill the process or use a different port
pnpm dev --port 3000
```

### ❌ Changes Don't Persist After Refresh

**Problem:** Using mock data instead of real API

**Solution:**

- Open `.env` file
- Make sure `VITE_USE_MOCK_DATA=false`
- Restart the dev server (Ctrl+C, then `pnpm dev` again)

### ❌ CORS Errors in Browser Console

**Problem:** Browser blocking API requests due to CORS policy

**Solution:**

- Spoolman should have CORS enabled by default
- If you see CORS errors, you may need to configure Spoolman to allow requests from `http://localhost:5173`
- Check Spoolman documentation for CORS configuration

### ❌ WebSocket Keeps Disconnecting

**Problem:** Unstable WebSocket connection

**What to check:**

- Network stability between your computer and Spoolman server
- The app automatically reconnects (you'll see status change to "Reconnecting...")
- Check browser console (F12) for WebSocket error messages

### 🐛 Still Having Issues?

1. **Check the browser console** (Press F12, go to Console tab)
2. **Look for error messages** - they often explain what's wrong
3. **Restart everything:**
   ```bash
   # Stop the dev server (Ctrl+C)
   # Clear cache
   rm -rf node_modules/.vite
   # Restart
   pnpm dev
   ```

---

## Development with Mock Data

If you want to test the interface **without** connecting to Spoolman:

1. Edit `.env` and set:

   ```env
   VITE_USE_MOCK_DATA=true
   ```

2. Restart the dev server

3. The app will use fake data from `src/mocks.json`
4. WebSocket will be disabled
5. Changes won't persist (they're only in browser memory)

This is useful for:

- Testing the UI when Spoolman is offline
- Development without affecting real data
- Demoing the interface

---

## Next Steps

Once you've verified everything works:

- **Customize the UI** by editing files in `src/pages/locations/`
- **Add features** by following the patterns in existing components
- **Build for production:** `pnpm build` creates optimized files in `dist/`
- **Deploy:** See `netlify.toml` for deployment configuration

---

## Project Structure

```
src/
├── pages/locations/         # Main location management page
│   ├── index.tsx           # Main page with drag & drop
│   ├── create-location-modal.tsx
│   ├── edit-location-modal.tsx
│   └── delete-location-dialog.tsx
├── providers/
│   ├── data.ts             # Data provider (API connection)
│   ├── auth.ts             # Auth provider (minimal)
│   └── websocket.ts        # WebSocket service
├── hooks/
│   └── useWebSocket.ts     # WebSocket connection hook
├── components/
│   └── websocket-status.tsx # Connection indicator
└── App.tsx                 # Main app configuration
```

---

## Need Help?

- **Spoolman Documentation:** [https://github.com/Donkie/Spoolman](https://github.com/Donkie/Spoolman)
- **Refine Documentation:** [https://refine.dev/docs](https://refine.dev/docs)
- Check `plan.md` for detailed development phases and features

---

**Happy organizing! 🎉**
