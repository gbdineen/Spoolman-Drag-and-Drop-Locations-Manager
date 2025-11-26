import { useState, useCallback, useEffect } from "react";
import { getWebSocketService, WebSocketMessage } from "../providers/websocket";

/**
 * Hook to manage on-demand WebSocket connections for listening to Spoolman broadcasts
 *
 * This hook provides a function to connect on-demand after API calls.
 * The connection automatically disconnects after receiving a message or after timeout.
 *
 * NOTE: This is LISTEN-ONLY. Do not send data via WebSocket.
 * All data changes must go through REST API calls.
 */
export function useWebSocket(wsUrl: string | null) {
  const [isListening, setIsListening] = useState(false);
  const [service] = useState(() => {
    if (wsUrl) {
      console.log(`[useWebSocket] Initializing on-demand WebSocket service for: ${wsUrl}`);
      return getWebSocketService(wsUrl);
    }
    console.log("[useWebSocket] No WebSocket URL provided, service disabled");
    return null;
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (service) {
        console.log("[useWebSocket] Component unmounting - disconnecting");
        service.disconnect();
      }
    };
  }, [service]);

  /**
   * Connect on-demand after an API call to listen for a single broadcast.
   * Automatically disconnects after receiving message or after 5-second timeout.
   *
   * @param onMessage - Callback when broadcast is received
   * @param onTimeout - Optional callback when timeout occurs (no broadcast received)
   * @returns Cleanup function to manually disconnect
   */
  const listenForBroadcast = useCallback(
    (onMessage: (message: WebSocketMessage) => void, onTimeout?: () => void) => {
      if (!service) {
        console.warn("[useWebSocket] Cannot listen - service not available");
        return () => {};
      }

      console.log("[useWebSocket] 🔌 Starting on-demand connection to listen for broadcast...");
      setIsListening(true);

      const cleanup = service.connectOnDemand(
        (message) => {
          setIsListening(false);
          onMessage(message);
        },
        () => {
          setIsListening(false);
          onTimeout?.();
        },
      );

      // Return enhanced cleanup that also updates state
      return () => {
        setIsListening(false);
        cleanup();
      };
    },
    [service],
  );

  return {
    listenForBroadcast,
    isListening,
    isAvailable: !!service,
  };
}
