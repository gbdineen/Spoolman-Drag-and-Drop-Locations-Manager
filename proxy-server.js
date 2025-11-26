#!/usr/bin/env node

/**
 * CORS Proxy for Spoolman API with WebSocket Support
 *
 * This proxy adds CORS headers to Spoolman API responses and forwards WebSocket connections.
 * Use this if your Spoolman container is not sending CORS headers properly.
 *
 * Usage:
 *   node proxy-server.js
 *
 * Then update your .env file:
 *   VITE_SPOOLMAN_API_URL=http://localhost:7913/api/v1
 *   VITE_SPOOLMAN_WS_URL=ws://localhost:7913/api/v1/ws
 */

import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import httpProxy from "http-proxy";
import cors from "cors";
import {
  initializeDatabase,
  getAllLocationOrders,
  getLocationOrder,
  updateLocationOrder,
  deleteLocationOrder,
  initializeLocationsFromSpoolman,
  closeDatabase,
  getDatabaseStats,
} from "./database.js";
import {
  initializeSpoolmanMonitor,
  registerFrontendClient,
  getMonitorStatus,
  reconnectMonitor,
  closeMonitor,
} from "./spoolman-monitor.js";

// Configuration
const SPOOLMAN_HOST = process.env.SPOOLMAN_HOST || "192.168.8.228";
const SPOOLMAN_PORT = process.env.SPOOLMAN_PORT || "7912";
const PROXY_PORT = process.env.PROXY_PORT || 7913;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "http://localhost:5173";

const SPOOLMAN_URL = `http://${SPOOLMAN_HOST}:${SPOOLMAN_PORT}`;

const app = express();

// Initialize database on startup
initializeDatabase();

// Initialize Spoolman WebSocket monitor
initializeSpoolmanMonitor();

// Fetch locations from Spoolman and initialize database
async function syncLocationsFromSpoolman() {
  try {
    console.log(`[${new Date().toISOString()}] 🔄 Syncing locations from Spoolman...`);
    const response = await fetch(`${SPOOLMAN_URL}/api/v1/location`);

    if (!response.ok) {
      throw new Error(`Failed to fetch locations: ${response.statusText}`);
    }

    const locations = await response.json();

    // Validate that we got an array
    if (!Array.isArray(locations)) {
      console.error(
        `[${new Date().toISOString()}] ❌ Invalid response from Spoolman: expected array, got ${typeof locations}`,
      );
      throw new Error("Invalid response from Spoolman API: expected array of locations");
    }

    console.log(`[${new Date().toISOString()}] 📥 Received ${locations.length} locations from Spoolman`);

    initializeLocationsFromSpoolman(locations);
    console.log(`[${new Date().toISOString()}] ✅ Locations synced from Spoolman`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Error syncing locations:`, error.message);
    console.error(`[${new Date().toISOString()}] 💡 Hint: Check that Spoolman is running at ${SPOOLMAN_URL}`);
  }
}

// Sync locations on startup (wait a bit for Spoolman to be ready)
setTimeout(() => {
  syncLocationsFromSpoolman();
}, 2000);

// Create a separate proxy instance for WebSocket handling
const wsProxy = httpProxy.createProxyServer({
  target: SPOOLMAN_URL,
  ws: true,
  changeOrigin: true,
});

// WebSocket proxy error handling
wsProxy.on("error", (err, req, socket) => {
  console.error(`❌ WebSocket proxy error: ${err.message}`);
  socket.end();
});

wsProxy.on("proxyReqWs", (proxyReq, req, socket, options, head) => {
  console.log(`[${new Date().toISOString()}] 🔌 WebSocket proxying: ${req.url} -> ${SPOOLMAN_URL}${req.url}`);
});

wsProxy.on("open", (proxySocket) => {
  console.log(`[${new Date().toISOString()}] 🔌 WebSocket connection established`);
});

wsProxy.on("close", (proxyRes, proxySocket, proxyHead) => {
  console.log(`[${new Date().toISOString()}] 🔌 WebSocket connection closed`);
});

// Enable CORS for all routes
app.use(
  cors({
    origin: ALLOWED_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
);

// Parse JSON bodies for our API endpoints
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  const dbStats = getDatabaseStats();
  res.json({
    status: "ok",
    proxy: `Proxying to ${SPOOLMAN_URL}`,
    cors: `Allowing origin: ${ALLOWED_ORIGIN}`,
    websocket: "WebSocket proxy enabled",
    database: dbStats,
  });
});

// Location Manager API Endpoints (Phase 7)

/**
 * GET /api/v1/location_manager/spool_order
 * Returns all location orders
 */
app.get("/api/v1/location_manager/spool_order", (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] 📥 GET /api/v1/location_manager/spool_order`);
    const orders = getAllLocationOrders();
    res.json({ locations: orders });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Error getting location orders:`, error);
    res.status(500).json({ error: "Failed to get location orders", message: error.message });
  }
});

/**
 * GET /api/v1/location_manager/spool_order/:locationName
 * Returns order for a specific location
 */
app.get("/api/v1/location_manager/spool_order/:locationName", (req, res) => {
  try {
    const locationName = decodeURIComponent(req.params.locationName);
    console.log(`[${new Date().toISOString()}] 📥 GET /api/v1/location_manager/spool_order/${locationName}`);

    if (!locationName || typeof locationName !== "string") {
      return res.status(400).json({ error: "Invalid location name" });
    }

    const order = getLocationOrder(locationName);
    res.json({ locationName, spoolIds: order });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Error getting location order:`, error);
    res.status(500).json({ error: "Failed to get location order", message: error.message });
  }
});

/**
 * POST /api/v1/location_manager/update_spool_order
 * Updates spool order for a location
 * Body: { locationName: string, spoolIds: number[] }
 */
app.post("/api/v1/location_manager/update_spool_order", async (req, res) => {
  try {
    const { locationName, spoolIds } = req.body;

    console.log(`[${new Date().toISOString()}] 📥 POST /api/v1/location_manager/update_spool_order`);
    console.log(`[${new Date().toISOString()}] 📋 Location: "${locationName}", Spools: ${spoolIds?.length || 0}`);

    // Validation
    if (typeof locationName !== "string" || !locationName.trim() || !Array.isArray(spoolIds)) {
      return res.status(400).json({
        error: "Invalid request",
        message: "locationName must be a non-empty string and spoolIds must be an array",
      });
    }

    // Verify all spool IDs are numbers
    if (!spoolIds.every((id) => typeof id === "number")) {
      return res.status(400).json({
        error: "Invalid spool IDs",
        message: "All spool IDs must be numbers",
      });
    }

    updateLocationOrder(locationName, spoolIds);

    res.json({
      success: true,
      locationName,
      spoolCount: spoolIds.length,
      message: `Updated order for location "${locationName}"`,
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Error updating location order:`, error);
    res.status(500).json({ error: "Failed to update location order", message: error.message });
  }
});

/**
 * DELETE /api/v1/location_manager/spool_order/:locationName
 * Deletes order data for a location
 */
app.delete("/api/v1/location_manager/spool_order/:locationName", (req, res) => {
  try {
    const locationName = decodeURIComponent(req.params.locationName);
    console.log(`[${new Date().toISOString()}] 📥 DELETE /api/v1/location_manager/spool_order/${locationName}`);

    if (!locationName || typeof locationName !== "string") {
      return res.status(400).json({ error: "Invalid location name" });
    }

    deleteLocationOrder(locationName);
    res.json({ success: true, locationName, message: `Deleted order for location "${locationName}"` });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Error deleting location order:`, error);
    res.status(500).json({ error: "Failed to delete location order", message: error.message });
  }
});

/**
 * POST /api/v1/location_manager/sync
 * Manually trigger sync with Spoolman locations
 */
app.post("/api/v1/location_manager/sync", async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] 📥 POST /api/v1/location_manager/sync`);
    await syncLocationsFromSpoolman();
    const dbStats = getDatabaseStats();
    res.json({ success: true, message: "Sync complete", stats: dbStats });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Error syncing locations:`, error);
    res.status(500).json({ error: "Failed to sync locations", message: error.message });
  }
});

/**
 * GET /api/v1/location_manager/stats
 * Get database statistics
 */
app.get("/api/v1/location_manager/stats", (req, res) => {
  try {
    const stats = getDatabaseStats();
    res.json(stats);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Error getting stats:`, error);
    res.status(500).json({ error: "Failed to get stats", message: error.message });
  }
});

/**
 * GET /api/v1/location_manager/monitor/status
 * Get WebSocket monitor status
 */
app.get("/api/v1/location_manager/monitor/status", (req, res) => {
  try {
    const status = getMonitorStatus();
    res.json(status);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Error getting monitor status:`, error);
    res.status(500).json({ error: "Failed to get monitor status", message: error.message });
  }
});

/**
 * POST /api/v1/location_manager/monitor/reconnect
 * Manually trigger monitor reconnection
 */
app.post("/api/v1/location_manager/monitor/reconnect", (req, res) => {
  try {
    reconnectMonitor();
    res.json({ success: true, message: "Reconnection initiated" });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Error reconnecting monitor:`, error);
    res.status(500).json({ error: "Failed to reconnect monitor", message: error.message });
  }
});

/**
 * GET /api/v1/location_manager/events
 * Server-Sent Events (SSE) endpoint for real-time notifications
 */
app.get("/api/v1/location_manager/events", (req, res) => {
  console.log(`[${new Date().toISOString()}] 📡 SSE client connected`);

  // Set headers for SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.flushHeaders();

  // Generate client ID
  const clientId = `sse-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Send function for this client
  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Register client with monitor
  const unregister = registerFrontendClient(clientId, sendEvent);

  // Send initial connection message
  sendEvent({ type: "connected", clientId });

  // Handle client disconnect
  req.on("close", () => {
    console.log(`[${new Date().toISOString()}] 📡 SSE client disconnected: ${clientId}`);
    unregister();
  });
});

// Create proxy middleware for API requests (HTTP only, not WebSocket)
const apiProxy = createProxyMiddleware({
  target: SPOOLMAN_URL,
  changeOrigin: true,
  ws: false, // We handle WebSocket separately with the upgrade event
  logLevel: process.env.DEBUG ? "debug" : "warn",
  // Preserve the full path including /api prefix
  pathRewrite: (path, req) => {
    // Express strips the /api mount path, so we need to add it back
    const rewrittenPath = `/api${path}`;
    console.log(`[${new Date().toISOString()}] 🔄 Path rewrite: ${path} -> ${rewrittenPath}`);
    return rewrittenPath;
  },
  onProxyReq: (proxyReq, req, res) => {
    const targetUrl = `${SPOOLMAN_URL}${proxyReq.path}`;
    console.log(`[${new Date().toISOString()}] 📤 ${req.method} ${req.url} -> ${targetUrl}`);
    console.log(`[${new Date().toISOString()}] 📋 Target path: ${proxyReq.path}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    const contentType = proxyRes.headers["content-type"] || "unknown";
    console.log(`[${new Date().toISOString()}] 📥 ${req.method} ${req.url} <- ${proxyRes.statusCode} ${contentType}`);

    // Log warning if we're getting HTML when we might expect JSON
    if (contentType.includes("text/html") && req.url.includes("/v1/")) {
      console.warn(`[${new Date().toISOString()}] ⚠️  WARNING: Received HTML for API endpoint ${req.url}`);
      console.warn(
        `[${new Date().toISOString()}] ⚠️  This usually means the path is wrong or Spoolman is serving its frontend`,
      );
    }
  },
  onError: (err, req, res) => {
    console.error(`❌ HTTP proxy error: ${err.message}`);
    if (res && res.writeHead) {
      res.status(502).json({
        error: "Proxy error",
        message: err.message,
        hint: `Cannot reach Spoolman at ${SPOOLMAN_URL}. Is the container running?`,
      });
    }
  },
});

// Proxy API requests to Spoolman
app.use("/api", apiProxy);

// Start server
const server = app.listen(PROXY_PORT, () => {
  console.log("");
  console.log("✅ CORS Proxy Server Running");
  console.log("==============================");
  console.log(`📍 Proxy URL:     http://localhost:${PROXY_PORT}`);
  console.log(`🎯 Target:        ${SPOOLMAN_URL}`);
  console.log(`🔓 Allowed Origin: ${ALLOWED_ORIGIN}`);
  console.log(`🔌 WebSocket:     Enabled`);
  console.log(`📦 Database:      Initialized`);
  console.log(`🔍 Monitor:       Active`);
  console.log("");
  console.log("📝 Update your .env file:");
  console.log(`   VITE_SPOOLMAN_API_URL=http://localhost:${PROXY_PORT}/api/v1`);
  console.log(`   VITE_SPOOLMAN_WS_URL=ws://localhost:${PROXY_PORT}/api/v1/ws`);
  console.log("");
  console.log("🧪 Test the proxy:");
  console.log(`   curl http://localhost:${PROXY_PORT}/health`);
  console.log(`   curl http://localhost:${PROXY_PORT}/api/v1/location`);
  console.log(`   curl http://localhost:${PROXY_PORT}/api/v1/location_manager/spool_order`);
  console.log("");
  console.log("📦 Location Manager API:");
  console.log(`   GET    /api/v1/location_manager/spool_order`);
  console.log(`   GET    /api/v1/location_manager/spool_order/:locationId`);
  console.log(`   POST   /api/v1/location_manager/update_spool_order`);
  console.log(`   DELETE /api/v1/location_manager/spool_order/:locationId`);
  console.log(`   POST   /api/v1/location_manager/sync`);
  console.log(`   GET    /api/v1/location_manager/stats`);
  console.log(`   GET    /api/v1/location_manager/monitor/status`);
  console.log(`   POST   /api/v1/location_manager/monitor/reconnect`);
  console.log(`   GET    /api/v1/location_manager/events (SSE)`);
  console.log("");
  console.log("⚙️  Environment variables:");
  console.log("   SPOOLMAN_HOST    - Spoolman server IP (default: 192.168.8.228)");
  console.log("   SPOOLMAN_PORT    - Spoolman server port (default: 7912)");
  console.log("   PROXY_PORT       - Proxy server port (default: 7913)");
  console.log("   ALLOWED_ORIGIN   - CORS allowed origin (default: http://localhost:5173)");
  console.log("   DB_PATH          - SQLite database path (default: ./spoolman-order.db)");
  console.log("   DEBUG=1          - Enable debug logging");
  console.log("");
  console.log("Press Ctrl+C to stop");
  console.log("==============================");
  console.log("");
});

// Handle WebSocket upgrade using the dedicated WebSocket proxy
server.on("upgrade", (req, socket, head) => {
  console.log(`[${new Date().toISOString()}] 🔌 WebSocket upgrade request received: ${req.url}`);

  // Check if this is an API WebSocket request
  if (req.url.startsWith("/api/")) {
    console.log(`[${new Date().toISOString()}] 🔌 Upgrading WebSocket connection for ${req.url}`);

    // Use the dedicated WebSocket proxy to handle the upgrade
    wsProxy.ws(req, socket, head);
  } else {
    console.log(`[${new Date().toISOString()}] ⚠️  WebSocket upgrade rejected: Invalid path ${req.url}`);
    socket.destroy();
  }
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n\n🛑 Shutting down proxy server...");
  closeMonitor();
  closeDatabase();
  wsProxy.close(() => {
    console.log("✅ WebSocket proxy closed");
  });
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});
