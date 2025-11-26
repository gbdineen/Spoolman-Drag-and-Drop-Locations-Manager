# How to Export and Run This Project Locally

This guide will walk you through exporting all the project files from this preview environment and running them on your local machine.

---

## 📦 Method 1: Download All Files (Recommended)

**If your preview environment has a "Download" or "Export" button**, use it to download the entire project as a ZIP file. This is the fastest method.

Once downloaded:

1. Extract the ZIP file to a folder on your computer
2. Skip to **[Setup Instructions](#-setup-instructions)** below

---

## 📋 Method 2: Manual File Copy (If No Download Option)

If there's no download button, you'll need to manually copy each file. Here's the complete list:

### Required Files & Folders

```
spoolman-location-manager/          ← Create this folder
├── public/
│   └── manifest.json               ← Copy this file
├── src/
│   ├── components/
│   │   ├── catch-all.tsx
│   │   └── websocket-status.tsx
│   ├── hooks/
│   │   └── useWebSocket.ts
│   ├── pages/
│   │   └── locations/
│   │       ├── index.tsx
│   │       ├── create-location-modal.tsx
│   │       ├── edit-location-modal.tsx
│   │       └── delete-location-dialog.tsx
│   ├── providers/
│   │   ├── auth.ts
│   │   ├── data.ts
│   │   └── websocket.ts
│   ├── types/
│   │   └── index.ts
│   ├── App.tsx
│   ├── index.tsx
│   ├── mocks.json
│   └── vite-env.d.ts
├── .env.example
├── .gitignore
├── index.html
├── netlify.toml
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── SETUP_GUIDE.md
└── README.md (create this, see below)
```

### Step-by-Step Copy Process

1. **Create the main folder** on your computer: `spoolman-location-manager`

2. **Create all subfolders:**

   - `public/`
   - `src/components/`
   - `src/hooks/`
   - `src/pages/locations/`
   - `src/providers/`
   - `src/types/`

3. **Copy each file's content:**

   - In the preview, click on each file
   - Copy its entire content
   - Create a new file with the same name in your local folder
   - Paste the content

4. **Critical files to copy** (in priority order):

   **First Priority** (won't run without these):

   - `package.json` - Lists all dependencies
   - `tsconfig.json` - TypeScript configuration
   - `vite.config.ts` - Build tool configuration
   - `index.html` - Entry HTML file
   - `.env.example` - Environment variable template
   - `src/index.tsx` - App entry point
   - `src/App.tsx` - Main app configuration

   **Second Priority** (core functionality):

   - `src/providers/data.ts` - API connection
   - `src/providers/websocket.ts` - WebSocket service
   - `src/providers/auth.ts` - Authentication
   - `src/pages/locations/index.tsx` - Main page
   - `src/types/index.ts` - TypeScript types
   - `src/hooks/useWebSocket.ts` - WebSocket hook
   - `src/components/websocket-status.tsx` - Status indicator

   **Third Priority** (features):

   - All dialog/modal files in `src/pages/locations/`
   - `src/mocks.json` - Mock data for testing
   - `src/components/catch-all.tsx` - 404 page

   **Fourth Priority** (optional but recommended):

   - `pnpm-lock.yaml` - Ensures exact package versions
   - `pnpm-workspace.yaml` - Workspace configuration
   - `tsconfig.node.json` - Node TypeScript config
   - `.gitignore` - Git ignore rules
   - `netlify.toml` - Deployment config
   - `public/manifest.json` - PWA manifest

---

## 🚀 Setup Instructions

Once you have all the files on your local machine:

### 1. Install Prerequisites

Make sure you have installed:

- **Node.js** (version 18 or higher) - [Download here](https://nodejs.org/)
- **pnpm** - Install by running:
  ```bash
  npm install -g pnpm
  ```

### 2. Install Project Dependencies

Open a terminal in your project folder and run:

```bash
pnpm install
```

This will download all required packages (~200MB, takes 2-5 minutes).

### 3. Configure Your Environment

Create your `.env` file:

```bash
cp .env.example .env
```

On Windows:

```cmd
copy .env.example .env
```

Edit the `.env` file with your Spoolman details:

```env
VITE_SPOOLMAN_API_URL=http://192.168.8.228:7912/api/v1
VITE_SPOOLMAN_WS_URL=ws://192.168.8.228:7912/api/v1/ws
VITE_USE_MOCK_DATA=false
```

**Change the IP address** if your Spoolman is running on a different address.

### 4. Start the Development Server

```bash
pnpm dev
```

You should see:

```
  VITE v5.x.x  ready in XXX ms

  ➜  Local:   http://localhost:5173/
```

### 5. Open in Browser

Navigate to `http://localhost:5173/`

You should see:

- ✅ Your locations and spools loaded from Spoolman
- ✅ Green "Connected" status in the top-right corner
- ✅ Drag and drop functionality working
- ✅ Changes saving to Spoolman API

---

## 🔧 Quick Reference

### Essential Commands

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

### Project Structure

```
src/
├── pages/locations/          # Main UI - drag & drop interface
├── providers/                # API and WebSocket connections
├── hooks/                    # React hooks (WebSocket)
├── components/               # Reusable UI components
├── types/                    # TypeScript type definitions
└── App.tsx                   # App configuration (Refine setup)
```

### Environment Variables

| Variable                | Description                       | Example                                 |
| ----------------------- | --------------------------------- | --------------------------------------- |
| `VITE_SPOOLMAN_API_URL` | Your Spoolman API endpoint        | `http://192.168.8.228:7912/api/v1`      |
| `VITE_SPOOLMAN_WS_URL`  | WebSocket endpoint                | `ws://192.168.8.228:7912/api/v1/ws`     |
| `VITE_USE_MOCK_DATA`    | Use mock data instead of real API | `false` (use real) or `true` (use mock) |

---

## 🐛 Troubleshooting

### "Cannot find module" or "Module not found" errors

**Solution:** Dependencies not installed

```bash
pnpm install
```

### "Port 5173 already in use"

**Solution:** Use a different port

```bash
pnpm dev --port 3000
```

### Can't connect to Spoolman API

**Check:**

1. Spoolman is running: Open `http://192.168.8.228:7912` in browser
2. `.env` file has correct IP address
3. You're on the same network as Spoolman
4. Your firewall isn't blocking the connection

### Changes don't save

**Check:**

1. `.env` has `VITE_USE_MOCK_DATA=false`
2. WebSocket status shows "Connected" (green)
3. Browser console (F12) for error messages

### TypeScript errors during `pnpm install`

**This is normal** - TypeScript checks happen after install. If the dev server starts successfully, you're good to go.

---

## 📚 Detailed Setup & Features

For comprehensive information about:

- Testing all features
- WebSocket real-time sync
- Location management
- Development with mock data
- Deployment

**See the included `SETUP_GUIDE.md` file** in your project folder.

---

## 🎯 What You Get

This project includes:

✅ **Drag & Drop Interface**

- Move spools between locations
- Reorder spools within locations
- Move spools to/from unassigned area

✅ **Location Management**

- Create new locations
- Edit location names
- Delete locations (spools move to unassigned)

✅ **Real-Time Sync**

- WebSocket integration
- Multi-client synchronization
- Automatic reconnection
- Connection status indicator

✅ **API Integration**

- Full Spoolman REST API support
- Automatic error handling
- Optimistic UI updates
- Rollback on failures

✅ **Developer Features**

- Mock data for testing
- TypeScript support
- Hot reload development
- Production build ready

---

## 🆘 Still Need Help?

1. **Check browser console** (Press F12) for error messages
2. **Review `SETUP_GUIDE.md`** for detailed troubleshooting
3. **Check `plan.md`** to understand the project phases and features
4. **Verify all files** were copied correctly (compare with file list above)

---

## 📖 Learning Resources

New to Refine? Here are some helpful links:

- **Refine Docs:** https://refine.dev/docs
- **Material UI Docs:** https://mui.com/material-ui/
- **Spoolman API:** https://github.com/Donkie/Spoolman

---

**You're all set! Happy coding! 🎉**
