/**
 * Persistent WebSocket Monitor for Spoolman
 *
 * This module maintains a persistent connection to Spoolman's WebSocket
 * to detect external changes (from other clients or direct Spoolman updates).
 *
 * When changes are detected, it notifies connected frontend clients.
 */

import WebSocket from "ws";

// Configuration
const SPOOLMAN_HOST = process.env.SPOOLMAN_HOST || "192.168.8.228";
const SPOOLMAN_PORT = process.env.SPOOLMAN_PORT || "7912";
const SPOOLMAN_WS_URL = `ws://${SPOOLMAN_HOST}:${SPOOLMAN_PORT}/api/v1/`;

// WebSocket state
let ws = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let isConnected = false;
let lastMessageTime = null;
let heartbeatTimer = null;

// Frontend client connections
const frontendClients = new Set();

// Reconnection settings
const RECONNECT_BASE_DELAY = 1000; // 1 second
const RECONNECT_MAX_DELAY = 30000; // 30 seconds
const RECONNECT_MAX_ATTEMPTS = 0; // 0 = infinite
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const CONNECTION_TIMEOUT = 60000; // 60 seconds

// State tracking for change detection
let lastSpoolState = null;
let lastLocationState = null;

/**
 * Initialize the persistent WebSocket connection to Spoolman
 */
export function initializeSpoolmanMonitor() {
  console.log(`[${new Date().toISOString()}] 🔍 Initializing Spoolman WebSocket monitor...`);
  connectToSpoolman();
}

/**
 * Connect to Spoolman WebSocket
 */
function connectToSpoolman() {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
    console.log(`[${new Date().toISOString()}] ⚠️  WebSocket already connected or connecting`);
    return;
  }

  console.log(`[${new Date().toISOString()}] 🔌 Connecting to Spoolman WebSocket: ${SPOOLMAN_WS_URL}`);

  try {
    ws = new WebSocket(SPOOLMAN_WS_URL);

    ws.on("open", handleOpen);
    ws.on("message", handleMessage);
    ws.on("error", handleError);
    ws.on("close", handleClose);
    ws.on("ping", handlePing);
    ws.on("pong", handlePong);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Failed to create WebSocket:`, error);
    scheduleReconnect();
  }
}

/**
 * Handle WebSocket open event
 */
function handleOpen() {
  console.log(`[${new Date().toISOString()}] ✅ Spoolman WebSocket monitor connected`);
  isConnected = true;
  reconnectAttempts = 0;
  lastMessageTime = Date.now();

  // Start heartbeat monitoring
  startHeartbeat();

  // Notify frontend clients
  broadcastToFrontend({ type: "monitor_connected" });

  // Fetch initial state for change detection
  fetchInitialState();
}

/**
 * Handle incoming WebSocket messages from Spoolman
 */
function handleMessage(data) {
  lastMessageTime = Date.now();

  try {
    const message = JSON.parse(data.toString());
    console.log(`[${new Date().toISOString()}] 📨 Spoolman broadcast received:`, message.type || "unknown");

    // Detect what changed and notify frontend
    detectChanges(message);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Error parsing WebSocket message:`, error);
  }
}

/**
 * Handle WebSocket errors
 */
function handleError(error) {
  console.error(`[${new Date().toISOString()}] ❌ Spoolman WebSocket error:`, error.message);
}

/**
 * Handle WebSocket close event
 */
function handleClose(code, reason) {
  console.log(`[${new Date().toISOString()}] 🔌 Spoolman WebSocket closed: ${code} ${reason}`);
  isConnected = false;

  stopHeartbeat();

  // Notify frontend clients
  broadcastToFrontend({ type: "monitor_disconnected" });

  scheduleReconnect();
}

/**
 * Handle ping from server
 */
function handlePing() {
  lastMessageTime = Date.now();
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.pong();
  }
}

/**
 * Handle pong from server
 */
function handlePong() {
  lastMessageTime = Date.now();
}

/**
 * Schedule reconnection with exponential backoff
 */
function scheduleReconnect() {
  if (reconnectTimer) {
    return; // Already scheduled
  }

  if (RECONNECT_MAX_ATTEMPTS > 0 && reconnectAttempts >= RECONNECT_MAX_ATTEMPTS) {
    console.log(`[${new Date().toISOString()}] ❌ Max reconnection attempts reached`);
    return;
  }

  reconnectAttempts++;
  const delay = Math.min(RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts - 1), RECONNECT_MAX_DELAY);

  console.log(`[${new Date().toISOString()}] ⏳ Reconnecting in ${delay}ms (attempt ${reconnectAttempts})...`);

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectToSpoolman();
  }, delay);
}

/**
 * Start heartbeat monitoring
 */
function startHeartbeat() {
  stopHeartbeat();

  heartbeatTimer = setInterval(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.log(`[${new Date().toISOString()}] 💔 WebSocket not open during heartbeat check`);
      stopHeartbeat();
      scheduleReconnect();
      return;
    }

    const now = Date.now();
    const timeSinceLastMessage = now - (lastMessageTime || now);

    if (timeSinceLastMessage > CONNECTION_TIMEOUT) {
      console.log(
        `[${new Date().toISOString()}] 💔 WebSocket connection stale (${timeSinceLastMessage}ms since last message)`,
      );
      ws.close();
      return;
    }

    // Send ping
    try {
      ws.ping();
      console.log(`[${new Date().toISOString()}] 💓 Heartbeat ping sent`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Heartbeat ping failed:`, error);
      ws.close();
    }
  }, HEARTBEAT_INTERVAL);
}

/**
 * Stop heartbeat monitoring
 */
function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

/**
 * Fetch initial state from Spoolman for change detection
 */
async function fetchInitialState() {
  try {
    const spoolmanUrl = `http://${SPOOLMAN_HOST}:${SPOOLMAN_PORT}`;

    // Fetch spools
    const spoolsResponse = await fetch(`${spoolmanUrl}/api/v1/spool`);
    if (spoolsResponse.ok) {
      lastSpoolState = await spoolsResponse.json();
      console.log(`[${new Date().toISOString()}] 📊 Initial spool state: ${lastSpoolState.length} spools`);
    }

    // Fetch locations
    const locationsResponse = await fetch(`${spoolmanUrl}/api/v1/location`);
    if (locationsResponse.ok) {
      lastLocationState = await locationsResponse.json();
      console.log(`[${new Date().toISOString()}] 📊 Initial location state: ${lastLocationState.length} locations`);
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Error fetching initial state:`, error);
  }
}

/**
 * Detect what changed based on the WebSocket message
 */
async function detectChanges(message) {
  try {
    let changeDetected = false;
    const changeDetails = {
      type: "external_change",
      changes: [],
    };

    // Check message type for hints
    if (message.type === "location" || message.resource === "location") {
      console.log(`[${new Date().toISOString()}] 🔍 Location change detected`);
      changeDetails.changes.push({ type: "location", action: message.action });
      changeDetected = true;
    }

    if (message.type === "spool" || message.resource === "spool") {
      console.log(`[${new Date().toISOString()}] 🔍 Spool change detected`);
      changeDetails.changes.push({ type: "spool", action: message.action });
      changeDetected = true;
    }

    // If any change detected, notify frontend
    if (changeDetected) {
      console.log(`[${new Date().toISOString()}] 📢 Broadcasting external change to ${frontendClients.size} clients`);
      broadcastToFrontend(changeDetails);
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Error detecting changes:`, error);
  }
}

/**
 * Register a frontend client for notifications
 */
export function registerFrontendClient(clientId, sendFunction) {
  const client = { id: clientId, send: sendFunction };
  frontendClients.add(client);
  console.log(
    `[${new Date().toISOString()}] 👤 Frontend client registered: ${clientId} (${frontendClients.size} total)`,
  );

  // Send current connection status
  client.send({
    type: "monitor_status",
    connected: isConnected,
  });

  return () => {
    frontendClients.delete(client);
    console.log(
      `[${new Date().toISOString()}] 👤 Frontend client unregistered: ${clientId} (${frontendClients.size} remaining)`,
    );
  };
}

/**
 * Broadcast message to all connected frontend clients
 */
function broadcastToFrontend(message) {
  const messageStr = JSON.stringify(message);

  for (const client of frontendClients) {
    try {
      client.send(message);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Error sending to client ${client.id}:`, error);
    }
  }
}

/**
 * Get monitor status
 */
export function getMonitorStatus() {
  return {
    connected: isConnected,
    reconnectAttempts,
    lastMessageTime,
    clientCount: frontendClients.size,
    wsUrl: SPOOLMAN_WS_URL,
  };
}

/**
 * Manually reconnect
 */
export function reconnectMonitor() {
  console.log(`[${new Date().toISOString()}] 🔄 Manual reconnect requested`);

  if (ws) {
    ws.close();
  }

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  reconnectAttempts = 0;
  connectToSpoolman();
}

/**
 * Close the monitor
 */
export function closeMonitor() {
  console.log(`[${new Date().toISOString()}] 🔒 Closing Spoolman monitor...`);

  stopHeartbeat();

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (ws) {
    ws.close();
    ws = null;
  }

  frontendClients.clear();
  isConnected = false;
}

export default {
  initializeSpoolmanMonitor,
  registerFrontendClient,
  getMonitorStatus,
  reconnectMonitor,
  closeMonitor,
};
