/**
 * Spoolman WebSocket Service - On-Demand Connection Model
 *
 * Connects to WebSocket ONLY after API calls to listen for Spoolman's broadcast confirmation.
 * Connection lifecycle:
 * 1. API call completes (move spool, create/edit/delete location)
 * 2. Connect to WebSocket
 * 3. Listen for single broadcast update
 * 4. Disconnect after receiving update OR after 5-second timeout
 *
 * NOTE: Spoolman WebSocket is LISTEN-ONLY (broadcast-only)
 * - Do NOT send messages to Spoolman via WebSocket
 * - All data changes go through REST API
 * - WebSocket is for receiving broadcast confirmations only
 */

type WebSocketMessage = {
  locations: {
    [locationName: string]: number[]; // Array of spool IDs
  };
};

type MessageCallback = (message: WebSocketMessage) => void;

class SpoolmanWebSocketService {
  private wsUrl: string;
  private activeConnection: WebSocket | null = null;
  private connectionTimeout: number | null = null;
  private readonly CONNECTION_TIMEOUT_MS = 5000; // 5 seconds

  constructor(wsUrl: string) {
    this.wsUrl = wsUrl;
    console.log(`[WebSocket] 🔧 On-demand service initialized with URL: ${wsUrl}`);
  }

  /**
   * Connect to WebSocket on-demand after an API call.
   * Listens for a single broadcast update, then disconnects.
   * Automatically disconnects after 5 seconds if no message received.
   */
  connectOnDemand(onMessage: MessageCallback, onTimeout?: () => void): () => void {
    // Close any existing connection
    this.disconnect();

    console.log(`[WebSocket] 🔌 Connecting on-demand to listen for broadcast...`);

    try {
      this.activeConnection = new WebSocket(this.wsUrl);

      // Set timeout for automatic disconnect
      this.connectionTimeout = setTimeout(() => {
        console.log("[WebSocket] ⏱️ Timeout reached (5s) - no broadcast received, disconnecting");
        this.disconnect();
        onTimeout?.();
      }, this.CONNECTION_TIMEOUT_MS);

      this.activeConnection.onopen = () => {
        console.log("[WebSocket] ✅ Connected (listening for single broadcast)");
      };

      this.activeConnection.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log("[WebSocket] 📨 Broadcast received from Spoolman:", message);

          // Notify callback
          onMessage(message);

          // Disconnect immediately after receiving message
          console.log("[WebSocket] ✓ Message received - disconnecting");
          this.disconnect();
        } catch (error) {
          console.error("[WebSocket] ❌ Failed to parse message:", error);
        }
      };

      this.activeConnection.onerror = (error) => {
        console.error("[WebSocket] ⚠️ Error event fired:", error);
        this.disconnect();
      };

      this.activeConnection.onclose = (event) => {
        console.log(
          `[WebSocket] 🔌 Connection closed - Code: ${event.code}, Reason: ${event.reason || "No reason provided"}`,
        );
        this.clearTimeout();
      };

      // Return cleanup function
      return () => this.disconnect();
    } catch (error) {
      console.error("[WebSocket] ❌ Connection failed with exception:", error);
      this.disconnect();
      return () => {};
    }
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect() {
    this.clearTimeout();

    if (this.activeConnection) {
      if (
        this.activeConnection.readyState === WebSocket.OPEN ||
        this.activeConnection.readyState === WebSocket.CONNECTING
      ) {
        this.activeConnection.close();
      }
      this.activeConnection = null;
    }
  }

  /**
   * Check if there's an active connection
   */
  isConnected(): boolean {
    return this.activeConnection?.readyState === WebSocket.OPEN;
  }

  private clearTimeout() {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
  }
}

// Singleton instance
let wsServiceInstance: SpoolmanWebSocketService | null = null;

/**
 * Get or create the WebSocket service instance
 */
export function getWebSocketService(wsUrl?: string): SpoolmanWebSocketService | null {
  // If no URL provided and no instance exists, return null
  if (!wsUrl && !wsServiceInstance) {
    return null;
  }

  // Create new instance if URL provided and different, or if no instance exists
  if (wsUrl && (!wsServiceInstance || wsServiceInstance["wsUrl"] !== wsUrl)) {
    if (wsServiceInstance) {
      wsServiceInstance.disconnect();
    }
    wsServiceInstance = new SpoolmanWebSocketService(wsUrl);
  }

  return wsServiceInstance;
}

/**
 * Cleanup WebSocket service
 */
export function cleanupWebSocketService() {
  if (wsServiceInstance) {
    wsServiceInstance.disconnect();
    wsServiceInstance = null;
  }
}

export type { WebSocketMessage };
