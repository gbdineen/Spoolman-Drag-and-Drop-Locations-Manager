# Quick Start Guide - Spoolman Location Manager

## Complete System with Backend Persistence

This guide gets you up and running with the full-featured Spoolman Location Manager including persistent spool ordering.

## Prerequisites

- Spoolman running (Docker or standalone)
- Node.js 18+ installed
- pnpm package manager

## Installation

```bash
# Install dependencies
pnpm install
```

## Configuration

1. **Copy environment template:**

```bash
cp .env.example .env
```

2. **Edit `.env` file:**

```bash
# Point to your Spoolman instance
VITE_SPOOLMAN_API_URL=http://localhost:7913/api/v1
VITE_SPOOLMAN_WS_URL=ws://localhost:7913/api/v1/ws

# Disable mock data
VITE_USE_MOCK_DATA=false
```

3. **Configure proxy server (if needed):**

```bash
# Set these environment variables or use defaults
export SPOOLMAN_HOST=192.168.8.228  # Your Spoolman IP
export SPOOLMAN_PORT=7912           # Your Spoolman port
export PROXY_PORT=7913              # Proxy port
```

## Running the Application

### Option 1: Full System (Recommended)

**Terminal 1 - Backend Server:**

```bash
npm run proxy
```

You should see:

```
✅ CORS Proxy Server Running
==============================
📍 Proxy URL:     http://localhost:7913
🎯 Target:        http://192.168.8.228:7912
🔌 WebSocket:     Enabled
📦 Database:      Initialized
🔍 Monitor:       Active
```

**Terminal 2 - Frontend:**

```bash
pnpm dev
```

Open browser: http://localhost:5173

### Option 2: Mock Data (Development)

```bash
# In .env
VITE_USE_MOCK_DATA=true

# Run frontend only
pnpm dev
```

## Features

### ✅ What Works Now

1. **Drag & Drop Spools**

   - Move spools between locations
   - Move spools to/from unassigned area
   - Reorder spools within a location
   - Visual feedback during drag operations

2. **Location Management**

   - Create new locations
   - Edit location names
   - Delete locations (spools move to unassigned)

3. **Persistent Ordering**

   - Custom spool order saved to database
   - Order persists across sessions
   - Works even if Spoolman restarts

4. **Real-Time Sync**

   - Changes from other clients appear instantly
   - WebSocket notifications
   - Automatic data refresh

5. **Error Handling**
   - Automatic rollback on failures
   - User-friendly notifications
   - Connection status indicators

## Usage

### Move Spools Between Locations

1. Find a spool in the unassigned area or a location
2. Click and drag the spool card
3. Drop it on a location card or back to unassigned
4. Changes save automatically

### Reorder Spools Within Location

1. Click and drag a spool card within a location
2. Move it up or down in the list
3. Drop in desired position
4. Order saves automatically

### Create Location

1. Click "Create Location" button
2. Enter location name
3. Click "Create"
4. Location appears immediately

### Edit Location

1. Click "Edit" button on location card
2. Change location name
3. Click "Save"
4. Name updates everywhere

### Delete Location

1. Click "Delete" button on location card
2. Confirm deletion
3. Spools move to unassigned area
4. Location removed

## Monitoring

### Check System Health

```bash
curl http://localhost:7913/health
```

### View Database Stats

```bash
curl http://localhost:7913/api/v1/location_manager/stats
```

### Check WebSocket Monitor

```bash
curl http://localhost:7913/api/v1/location_manager/monitor/status
```

## Database

### Location

Database file: `./spoolman-order.db`

### Backup

```bash
cp spoolman-order.db spoolman-order.db.backup
```

### Reset

```bash
rm spoolman-order.db
npm run proxy  # Recreates database
```

## Troubleshooting

### Backend Won't Start

**Check Spoolman is running:**

```bash
curl http://192.168.8.228:7912/api/v1/health
```

**Check port availability:**

```bash
lsof -i :7913
```

### Frontend Shows Errors

1. Verify backend is running: `curl http://localhost:7913/health`
2. Check browser console for specific errors
3. Verify `.env` configuration
4. Check CORS settings

### Order Not Saving

1. Ensure backend is running
2. Check `spoolman-order.db` file exists
3. View browser network tab for API errors
4. Check backend logs

### External Changes Not Showing

1. Check monitor status (should show "connected")
2. Verify SSE connection in browser network tab
3. Test with another client or direct Spoolman update

## Advanced

### Custom Database Path

```bash
DB_PATH=/custom/path/spoolman-order.db npm run proxy
```

### Enable Debug Logging

```bash
DEBUG=1 npm run proxy
```

### Different Ports

```bash
PROXY_PORT=8913 npm run proxy
# Update .env to use port 8913
```

## Documentation

- **BACKEND_PERSISTENCE_GUIDE.md** - Complete backend documentation
- **plan.md** - Project roadmap and status
- **WEBSOCKET_ON_DEMAND_MODEL.md** - WebSocket architecture
- **PROXY_SETUP.md** - CORS proxy details

## Support

For issues or questions:

1. Check existing documentation files
2. Review backend logs
3. Test with mock data to isolate issues
4. Verify Spoolman is functioning properly

## What's Next?

The system is feature-complete! Optional enhancements:

- User authentication
- Order history/undo
- Export/import configurations
- Mobile-responsive improvements
- Dark mode theme

Enjoy managing your spool locations! 🎉
