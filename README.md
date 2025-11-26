# 🎯 Spoolman Drag & Drop Location Manager

A beautiful, drag-and-drop interface for managing spool locations in [Spoolman](https://github.com/Donkie/Spoolman).

## ✨ Features

- 🎨 **Visual drag-and-drop interface** - Move spools between locations with ease
- 📍 **Location management** - Create, edit, and delete locations
- 🔄 **Real-time sync** - WebSocket integration keeps all clients in sync
- 💾 **Persistent storage** - All changes saved to Spoolman API
- 🎭 **Mock data mode** - Test the interface without a real Spoolman instance
- 📱 **Responsive design** - Works on desktop and mobile devices

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and pnpm installed
- **Spoolman** instance running (Docker recommended)
- For local development: Spoolman accessible on your network

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd spoolman-location-manager

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

Open browser at **http://localhost:5173**

---

## ⚙️ Configuration

### Using Mock Data (Default)

Perfect for testing without a real Spoolman instance:

```env
VITE_USE_MOCK_DATA=true
```

Just run `pnpm dev` and you're ready to go!

### Connecting to Real Spoolman

#### Step 1: Configure Environment

Create/edit `.env` file:

```env
VITE_SPOOLMAN_API_URL=http://192.168.8.228:7912/api/v1
VITE_SPOOLMAN_WS_URL=ws://192.168.8.228:7912/api/v1/ws
VITE_USE_MOCK_DATA=false
```

Replace `192.168.8.228:7912` with your Spoolman host and port.

#### Step 2: Enable CORS in Spoolman

**If using docker-compose.yml:**

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
```

**If using docker run:**

```bash
docker run -d \
  -p 7912:8000 \
  -e CORS_ALLOWED_ORIGINS="http://localhost:5173" \
  --name spoolman \
  -v spoolman_data:/home/app/.local/share/spoolman \
  ghcr.io/donkie/spoolman:latest
```

Then restart: `docker-compose down && docker-compose up -d`

#### Step 3: ⚠️ If CORS Still Doesn't Work (Known Issue)

Some Spoolman versions don't respect the CORS environment variable. **Solution: Use the built-in proxy!**

```bash
# Terminal 1: Start the CORS proxy
npm install express http-proxy-middleware cors
npm run proxy

# Terminal 2: Start your app
pnpm dev
```

Update `.env` to use proxy:

```env
VITE_SPOOLMAN_API_URL=http://localhost:7913/api/v1
VITE_SPOOLMAN_WS_URL=ws://localhost:7913/api/v1/ws
VITE_USE_MOCK_DATA=false
```

See **[PROXY_SETUP.md](./PROXY_SETUP.md)** for detailed instructions.

---

## 📖 Documentation

- **[PROXY_SETUP.md](./PROXY_SETUP.md)** - Complete CORS proxy setup guide (if Spoolman CORS doesn't work)
- **[CORS_FIX.md](./CORS_FIX.md)** - How to configure CORS in Spoolman
- **[SPOOLMAN_CORS_INVESTIGATION.md](./SPOOLMAN_CORS_INVESTIGATION.md)** - Technical investigation of the CORS issue
- **[PREVIEW_ENVIRONMENT_LIMITATION.md](./PREVIEW_ENVIRONMENT_LIMITATION.md)** - Why preview environment can't connect to local Spoolman
- **[WEBSOCKET_TROUBLESHOOTING.md](./WEBSOCKET_TROUBLESHOOTING.md)** - WebSocket connection troubleshooting

---

## 🛠️ Development

### Available Commands

```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview

# Run CORS proxy (if needed)
npm run proxy

# Run linter
pnpm lint
```

### Project Structure

```
src/
├── App.tsx                          # Main app component with Refine setup
├── index.tsx                        # Entry point
├── pages/
│   └── locations/
│       ├── index.tsx                # Main locations page with drag-and-drop
│       ├── create-location-modal.tsx
│       ├── edit-location-modal.tsx
│       └── delete-location-dialog.tsx
├── providers/
│   ├── data.ts                      # Data provider (REST API + mock)
│   ├── auth.ts                      # Auth provider (mock)
│   └── websocket.ts                 # WebSocket service
├── hooks/
│   └── useWebSocket.ts              # WebSocket React hook
└── types/
    └── index.ts                     # TypeScript types

proxy-server.js                      # CORS proxy for Spoolman
```

---

## 🐛 Troubleshooting

### CORS Errors

**Symptom:** Browser console shows "Access-Control-Allow-Origin" errors

**Solutions:**

1. **Method 1:** Configure CORS in Spoolman (see [CORS_FIX.md](./CORS_FIX.md))
2. **Method 2:** Use the proxy (see [PROXY_SETUP.md](./PROXY_SETUP.md)) ← **Recommended if CORS config doesn't work**

```bash
# Quick fix: Use the proxy
npm run proxy
# Then update .env to use http://localhost:7913/api/v1
```

### WebSocket Not Connecting

1. **Check WebSocket URL** in `.env`:

   ```env
   VITE_SPOOLMAN_WS_URL=ws://192.168.8.228:7912/api/v1/ws
   ```

2. **If using proxy**, make sure WebSocket URL uses proxy:

   ```env
   VITE_SPOOLMAN_WS_URL=ws://localhost:7913/api/v1/ws
   ```

3. **Test WebSocket** in browser console:
   ```javascript
   const ws = new WebSocket("ws://192.168.8.228:7912/api/v1/ws");
   ws.onopen = () => console.log("Connected!");
   ws.onerror = (e) => console.error("Error:", e);
   ```

### Can't Connect from Preview Environment

**This is expected!** Preview environments use HTTPS, which cannot connect to HTTP/WS endpoints.

**Solution:** Run locally with `pnpm dev`

See [PREVIEW_ENVIRONMENT_LIMITATION.md](./PREVIEW_ENVIRONMENT_LIMITATION.md) for details.

### API Not Responding

1. **Check Spoolman is running:**

   ```bash
   docker ps | grep spoolman
   curl http://192.168.8.228:7912/api/v1/health
   ```

2. **Check network connectivity** - Make sure your machine can reach the Spoolman host

3. **Try mock data mode** to verify the app works:
   ```env
   VITE_USE_MOCK_DATA=true
   ```

---

## 🔌 API Integration

This app uses the Spoolman REST API and WebSocket for real-time updates.

### REST API Endpoints Used

- `GET /api/v1/location` - List all locations
- `POST /api/v1/location` - Create location
- `PATCH /api/v1/location/:id` - Update location
- `DELETE /api/v1/location/:id` - Delete location
- `GET /api/v1/spool` - List all spools
- `PATCH /api/v1/spool/:id` - Update spool location

### WebSocket

- `ws://host:port/api/v1/ws` - Real-time updates from Spoolman
- **Listen-only** - Spoolman broadcasts changes, clients receive updates
- All data changes go through REST API

---

## 🎨 UI Components

Built with:

- **Refine** - Framework for data-heavy applications
- **Material-UI** - React component library
- **@dnd-kit** - Drag and drop primitives
- **TypeScript** - Type safety

---

## 📦 Deployment

### Build for Production

```bash
pnpm build
```

Output in `dist/` folder.

### Deploy to Netlify/Vercel

1. Build command: `pnpm build`
2. Publish directory: `dist`
3. Set environment variables in platform settings

**Note:** When deployed, you'll need to ensure your Spoolman instance is accessible from the internet with proper CORS configuration, OR deploy the proxy alongside your app.

---

## 🤝 Contributing

Contributions welcome! Please feel free to submit a Pull Request.

---

## 📄 License

MIT License - feel free to use this project however you'd like!

---

## 🙏 Acknowledgments

- [Spoolman](https://github.com/Donkie/Spoolman) - The excellent 3D printing spool management system
- [Refine](https://refine.dev/) - Framework for building data-heavy applications
- [Material-UI](https://mui.com/) - Beautiful React components
- [@dnd-kit](https://dndkit.com/) - Modern drag and drop toolkit

---

## 📞 Support

- Check the documentation files for detailed troubleshooting
- Open an issue on GitHub
- For Spoolman-specific issues, see the [Spoolman repository](https://github.com/Donkie/Spoolman)

---

## 🎯 Quick Reference

### Most Common Setup (with proxy)

```bash
# 1. Install dependencies
pnpm install
npm install express http-proxy-middleware cors

# 2. Start proxy (terminal 1)
npm run proxy

# 3. Update .env
cat > .env << EOF
VITE_SPOOLMAN_API_URL=http://localhost:7913/api/v1
VITE_SPOOLMAN_WS_URL=ws://localhost:7913/api/v1/ws
VITE_USE_MOCK_DATA=false
EOF

# 4. Start app (terminal 2)
pnpm dev
```

That's it! Open http://localhost:5173 🚀
