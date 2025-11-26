/**
 * Location Order Service
 *
 * Manages spool order persistence through the backend API.
 * Separates order management from Spoolman's location assignments.
 *
 * NOTE: Uses location NAMES as identifiers (not numeric IDs) to match Spoolman's format.
 */

const BACKEND_URL = import.meta.env.VITE_SPOOLMAN_API_URL || "http://localhost:7913/api/v1";
const LOCATION_MANAGER_BASE = `${BACKEND_URL.replace("/api/v1", "")}/api/v1/location_manager`;
const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA === "true";

interface LocationOrders {
  locations: Record<string, number[]>; // Changed from number to string keys
}

/**
 * Get all location orders from backend
 */
export async function getAllLocationOrders(): Promise<Record<string, number[]>> {
  if (USE_MOCK) {
    console.log("[Location Order] Mock mode - returning empty orders");
    return {};
  }

  try {
    const response = await fetch(`${LOCATION_MANAGER_BASE}/spool_order`);

    if (!response.ok) {
      throw new Error(`Failed to fetch location orders: ${response.statusText}`);
    }

    const data: LocationOrders = await response.json();
    console.log("[Location Order] Fetched orders for", Object.keys(data.locations).length, "locations");
    return data.locations;
  } catch (error) {
    console.error("[Location Order] Error fetching orders:", error);
    return {};
  }
}

/**
 * Get spool order for a specific location
 */
export async function getLocationOrder(locationName: string): Promise<number[]> {
  if (USE_MOCK) {
    return [];
  }

  try {
    const encodedName = encodeURIComponent(locationName);
    const response = await fetch(`${LOCATION_MANAGER_BASE}/spool_order/${encodedName}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch location order: ${response.statusText}`);
    }

    const data = await response.json();
    return data.spoolIds || [];
  } catch (error) {
    console.error(`[Location Order] Error fetching order for location "${locationName}":`, error);
    return [];
  }
}

/**
 * Update spool order for a location
 */
export async function updateLocationOrder(locationName: string, spoolIds: number[]): Promise<boolean> {
  if (USE_MOCK) {
    console.log(`[Location Order] Mock mode - would update location "${locationName}" with ${spoolIds.length} spools`);
    return true;
  }

  try {
    const response = await fetch(`${LOCATION_MANAGER_BASE}/update_spool_order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        locationName,
        spoolIds,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Failed to update location order: ${response.statusText}`);
    }

    console.log(`[Location Order] ✅ Updated order for location "${locationName}": ${spoolIds.length} spools`);
    return true;
  } catch (error) {
    console.error(`[Location Order] ❌ Error updating order for location "${locationName}":`, error);
    throw error;
  }
}

/**
 * Delete order data for a location
 */
export async function deleteLocationOrder(locationName: string): Promise<boolean> {
  if (USE_MOCK) {
    console.log(`[Location Order] Mock mode - would delete order for location "${locationName}"`);
    return true;
  }

  try {
    const encodedName = encodeURIComponent(locationName);
    const response = await fetch(`${LOCATION_MANAGER_BASE}/spool_order/${encodedName}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error(`Failed to delete location order: ${response.statusText}`);
    }

    console.log(`[Location Order] ✅ Deleted order for location "${locationName}"`);
    return true;
  } catch (error) {
    console.error(`[Location Order] ❌ Error deleting order for location "${locationName}":`, error);
    throw error;
  }
}

/**
 * Sync locations with Spoolman (trigger backend sync)
 */
export async function syncLocationsWithSpoolman(): Promise<boolean> {
  if (USE_MOCK) {
    return true;
  }

  try {
    const response = await fetch(`${LOCATION_MANAGER_BASE}/sync`, {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(`Failed to sync locations: ${response.statusText}`);
    }

    console.log("[Location Order] ✅ Synced locations with Spoolman");
    return true;
  } catch (error) {
    console.error("[Location Order] ❌ Error syncing locations:", error);
    throw error;
  }
}

/**
 * Get monitor status
 */
export async function getMonitorStatus() {
  if (USE_MOCK) {
    return { connected: false, message: "Mock mode" };
  }

  try {
    const response = await fetch(`${LOCATION_MANAGER_BASE}/monitor/status`);

    if (!response.ok) {
      throw new Error(`Failed to get monitor status: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("[Location Order] Error getting monitor status:", error);
    return { connected: false, error: (error as Error).message };
  }
}

export default {
  getAllLocationOrders,
  getLocationOrder,
  updateLocationOrder,
  deleteLocationOrder,
  syncLocationsWithSpoolman,
  getMonitorStatus,
};
