/**
 * Hook to listen for external Spoolman changes via Server-Sent Events (SSE)
 *
 * Connects to the backend monitor's SSE endpoint to receive real-time notifications
 * when Spoolman data changes from external sources (other clients, direct updates).
 */

import { useEffect, useState, useRef } from "react";

const BACKEND_URL = import.meta.env.VITE_SPOOLMAN_API_URL || "http://localhost:7913/api/v1";
const SSE_ENDPOINT = BACKEND_URL.replace("/api/v1", "/api/v1/location_manager/events");
const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA === "true";

interface ExternalChangeEvent {
  type: string;
  changes?: Array<{
    type: "spool" | "location";
    action?: string;
  }>;
}

interface MonitorStatus {
  connected: boolean;
  clientCount?: number;
}

export function useExternalChanges(onExternalChange?: () => void) {
  const [monitorStatus, setMonitorStatus] = useState<MonitorStatus>({ connected: false });
  const [lastChangeTime, setLastChangeTime] = useState<Date | null>(null);

  // Store callback in ref to prevent reconnection loops
  const callbackRef = useRef(onExternalChange);

  // Update ref when callback changes
  useEffect(() => {
    callbackRef.current = onExternalChange;
  }, [onExternalChange]);

  useEffect(() => {
    // Skip SSE connection in mock mode
    if (USE_MOCK) {
      console.log("[External Changes] Mock mode - SSE disabled");
      return;
    }

    console.log("[External Changes] Connecting to SSE endpoint:", SSE_ENDPOINT);

    let eventSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      try {
        eventSource = new EventSource(SSE_ENDPOINT);

        eventSource.onopen = () => {
          console.log("[External Changes] ✅ SSE connected");
        };

        eventSource.onmessage = (event) => {
          try {
            const data: ExternalChangeEvent = JSON.parse(event.data);
            console.log("[External Changes] 📨 Message received:", data);

            if (data.type === "connected") {
              console.log("[External Changes] Connected with client ID:", (data as any).clientId);
            } else if (data.type === "monitor_status") {
              setMonitorStatus({
                connected: (data as any).connected,
              });
            } else if (data.type === "monitor_connected") {
              setMonitorStatus({ connected: true });
            } else if (data.type === "monitor_disconnected") {
              setMonitorStatus({ connected: false });
            } else if (data.type === "external_change") {
              console.log("[External Changes] 🔄 External change detected:", data.changes);
              setLastChangeTime(new Date());

              // Notify parent component to refresh data using ref
              if (callbackRef.current) {
                callbackRef.current();
              }
            }
          } catch (error) {
            console.error("[External Changes] ❌ Error parsing SSE message:", error);
          }
        };

        eventSource.onerror = (error) => {
          console.error("[External Changes] ❌ SSE error:", error);
          eventSource?.close();

          // Reconnect after 5 seconds
          reconnectTimeout = setTimeout(() => {
            console.log("[External Changes] 🔄 Reconnecting...");
            connect();
          }, 5000);
        };
      } catch (error) {
        console.error("[External Changes] ❌ Failed to create EventSource:", error);
      }
    };

    connect();

    // Cleanup on unmount
    return () => {
      console.log("[External Changes] 🔌 Disconnecting SSE");
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []); // Empty dependency array - only connect once

  return {
    monitorStatus,
    lastChangeTime,
  };
}
