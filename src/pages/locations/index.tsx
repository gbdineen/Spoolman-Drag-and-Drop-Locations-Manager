import { useList, useUpdate, useNotification } from "@refinedev/core";
import { Box, Card, CardContent, CircularProgress, Grid, Typography, Alert, Button, Chip, Stack } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  DragOverEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import debounce from "lodash.debounce";
import type { Spool, Location } from "../../types";
import { CreateLocationModal } from "./create-location-modal";
import { EditLocationModal } from "./edit-location-modal";
import { DeleteLocationDialog } from "./delete-location-dialog";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useExternalChanges } from "../../hooks/useExternalChanges";
import { WebSocketStatus } from "../../components/websocket-status";
import * as locationOrderService from "../../providers/location-order";

const WS_URL = import.meta.env.VITE_SPOOLMAN_WS_URL || null;
const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === "true";

export const LocationsPage = () => {
  const [activeId, setActiveId] = useState<number | null>(null);
  // Track local ordering of spools within each location (by location NAME, not ID)
  const [localSpoolOrder, setLocalSpoolOrder] = useState<Record<string, number[]>>({});
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editLocation, setEditLocation] = useState<Location | null>(null);
  const [deleteLocation, setDeleteLocation] = useState<Location | null>(null);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);

  // Track pending updates for rollback
  const previousSpoolStateRef = useRef<{ spoolId: number; location: string | null } | null>(null);

  // WebSocket integration (disabled for mock data) - ON-DEMAND MODEL!
  const { listenForBroadcast, isListening, isAvailable } = useWebSocket(!USE_MOCK_DATA ? WS_URL : null);

  // External changes monitoring via SSE
  const { monitorStatus } = useExternalChanges(() => {
    console.log("[LocationsPage] 🔄 External change detected - refreshing data...");
    handleRefresh();
  });

  const { open: openNotification } = useNotification();

  const {
    data: locationsData,
    isLoading: locationsLoading,
    isError: locationsError,
    refetch: refetchLocations,
  } = useList<Location>({
    resource: "location",
    pagination: {
      mode: "off",
    },
  });

  const {
    data: spoolsData,
    isLoading: spoolsLoading,
    isError: spoolsError,
    refetch: refetchSpools,
  } = useList<Spool>({
    resource: "spool",
    pagination: {
      mode: "off",
    },
  });

  // Debug logging
  console.log("[LocationsPage] 🔍 Data loading state:", {
    locationsLoading,
    spoolsLoading,
    locationsError,
    spoolsError,
    locationsCount: locationsData?.data?.length ?? 0,
    spoolsCount: spoolsData?.data?.length ?? 0,
  });

  console.log("[LocationsPage] 📍 Locations data:", locationsData?.data);
  console.log("[LocationsPage] 🎯 Spools data:", spoolsData?.data);

  const { mutate: updateSpool } = useUpdate();

  // Load order data from backend on mount and when locations change
  useEffect(() => {
    if (!locationsData?.data || USE_MOCK_DATA) return;

    const loadOrders = async () => {
      setIsLoadingOrders(true);
      try {
        const orders = await locationOrderService.getAllLocationOrders();
        console.log("[LocationsPage] 📦 Loaded orders from backend:", orders);
        setLocalSpoolOrder(orders);
      } catch (error) {
        console.error("[LocationsPage] ❌ Failed to load orders:", error);
      } finally {
        setIsLoadingOrders(false);
      }
    };

    loadOrders();
  }, [locationsData?.data?.length]);

  const handleRefresh = () => {
    refetchLocations();
    refetchSpools();
    // Reload orders from backend
    if (!USE_MOCK_DATA) {
      locationOrderService.getAllLocationOrders().then((orders) => {
        setLocalSpoolOrder(orders);
      });
    }
  };

  const locations = locationsData?.data ?? [];
  const spools = spoolsData?.data ?? [];

  console.log("[LocationsPage] 🎨 Processing:", {
    locationsCount: locations.length,
    spoolsCount: spools.length,
  });

  // Create a map of location names to IDs
  const locationNameToId = useMemo(() => {
    const map: Record<string, number> = {};
    locations.forEach((loc) => {
      map[loc.name] = loc.id;
    });
    console.log("[LocationsPage] 🗺️  Location name to ID map:", map);
    return map;
  }, [locations]);

  // Group spools by location
  const spoolsByLocation: Record<string, Spool[]> = {};
  const unassignedSpools: Spool[] = [];

  spools.forEach((spool) => {
    if (spool.location) {
      if (!spoolsByLocation[spool.location]) {
        spoolsByLocation[spool.location] = [];
      }
      spoolsByLocation[spool.location].push(spool);
    } else {
      unassignedSpools.push(spool);
    }
  });

  console.log("[LocationsPage] 📦 Spools by location:", spoolsByLocation);
  console.log("[LocationsPage] 📭 Unassigned spools:", unassignedSpools.length);

  // Apply local ordering to spools
  const orderedSpoolsByLocation = useMemo(() => {
    const result: Record<string, Spool[]> = {};

    Object.keys(spoolsByLocation).forEach((locationName) => {
      const locationSpools = spoolsByLocation[locationName];
      const order = localSpoolOrder[locationName];

      if (order && order.length > 0) {
        // Apply custom order - merge with current spools
        const orderedSpools: Spool[] = [];
        const remainingSpools = [...locationSpools];

        // Add spools in order
        order.forEach((id) => {
          const spool = remainingSpools.find((s) => s.id === id);
          if (spool) {
            orderedSpools.push(spool);
            remainingSpools.splice(remainingSpools.indexOf(spool), 1);
          }
        });

        // Add any remaining spools that weren't in the order
        orderedSpools.push(...remainingSpools);
        result[locationName] = orderedSpools;
      } else {
        // Use default order
        result[locationName] = locationSpools;
      }
    });

    return result;
  }, [spoolsByLocation, localSpoolOrder]);

  /**
   * Listen for broadcast after API call (on-demand)
   */
  const listenAfterApiCall = useCallback(() => {
    if (!isAvailable) return;

    console.log("[LocationsPage] 🔌 API call completed - listening for broadcast confirmation...");

    listenForBroadcast(
      (message) => {
        console.log("[LocationsPage] ✅ Broadcast received - refreshing data", message);
        handleRefresh();
      },
      () => {
        console.log("[LocationsPage] ⏱️ No broadcast received within timeout");
        // Optionally refresh anyway
        handleRefresh();
      },
    );
  }, [isAvailable, listenForBroadcast]);

  // Debounced function to update spool location
  const debouncedUpdateSpool = useCallback(
    debounce(
      (
        spoolId: number,
        newLocation: string | null,
        previousLocation: string | null,
        localOrderSnapshot: Record<string, number[]>,
      ) => {
        updateSpool(
          {
            resource: "spool",
            id: spoolId,
            values: {
              location: newLocation,
            },
            successNotification: {
              message: "Spool location updated successfully",
              type: "success",
              description: newLocation ? `Moved to ${newLocation}` : "Moved to unassigned",
            },
            errorNotification: false, // We'll handle errors manually
          },
          {
            onSuccess: async () => {
              // REST API update successful - save order to backend and listen for broadcast
              console.log("[API] Spool location updated - saving order and listening for broadcast...");

              // Save updated order to backend (using location name)
              if (newLocation) {
                try {
                  const currentOrder = localSpoolOrder[newLocation] || [];
                  await locationOrderService.updateLocationOrder(newLocation, currentOrder);
                } catch (error) {
                  console.error("[API] Failed to save order:", error);
                }
              }

              listenAfterApiCall();
            },
            onError: (error) => {
              // Rollback local state on error
              console.error("Failed to update spool location:", error);

              // Restore previous order state
              setLocalSpoolOrder(localOrderSnapshot);

              // Show error notification with rollback message
              openNotification?.({
                type: "error",
                message: "Failed to update spool location",
                description: "The change has been reverted. Please try again.",
              });
            },
          },
        );
      },
      300,
    ),
    [updateSpool, openNotification, listenAfterApiCall, localSpoolOrder],
  );

  // Debounced function to save reordering within a location
  const debouncedSaveOrder = useCallback(
    debounce(async (locationName: string, orderedSpoolIds: number[], previousOrder: number[]) => {
      console.log("Saving reorder for location:", locationName, orderedSpoolIds);

      try {
        // Save order to backend
        await locationOrderService.updateLocationOrder(locationName, orderedSpoolIds);

        // Show success feedback
        openNotification?.({
          type: "success",
          message: "Spools reordered",
          description: `Order saved successfully`,
        });
      } catch (error) {
        console.error("Failed to save order:", error);

        // Rollback on error
        setLocalSpoolOrder((prev) => ({
          ...prev,
          [locationName]: previousOrder,
        }));

        openNotification?.({
          type: "error",
          message: "Failed to save order",
          description: "The change has been reverted.",
        });
      }
    }, 500),
    [openNotification],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as number);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;

    if (!over) return;

    const activeId = active.id as number;
    const overId = over.id;

    // Find active and over spools
    const activeSpool = spools.find((s) => s.id === activeId);
    const overSpool = spools.find((s) => s.id === overId);

    // Check if we're reordering within the same location
    if (activeSpool && overSpool && activeSpool.location === overSpool.location && activeSpool.location) {
      const locationName = activeSpool.location;
      const locationSpools = orderedSpoolsByLocation[locationName] || [];
      const currentOrder = locationSpools.map((s) => s.id);

      const oldIndex = currentOrder.indexOf(activeId);
      const newIndex = currentOrder.indexOf(overId as number);

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const previousOrder = [...currentOrder];
        const newOrder = arrayMove(currentOrder, oldIndex, newIndex);

        setLocalSpoolOrder((prev) => ({
          ...prev,
          [locationName]: newOrder,
        }));

        // Save the new order with debouncing
        debouncedSaveOrder(locationName, newOrder, previousOrder);
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const spoolId = active.id as number;
    const overId = over.id;

    // Find the spool being dragged
    const draggedSpool = spools.find((s) => s.id === spoolId);
    if (!draggedSpool) return;

    // Check if dragging over another spool (reordering within same location)
    const overSpool = spools.find((s) => s.id === overId);

    if (overSpool && draggedSpool.location === overSpool.location && draggedSpool.location) {
      // This is a reorder within the same location - already handled in handleDragOver
      // The debounced save has been triggered
      return;
    }

    // Save current state for rollback
    const previousLocation = draggedSpool.location;
    const localOrderSnapshot = { ...localSpoolOrder };
    previousSpoolStateRef.current = {
      spoolId,
      location: previousLocation,
    };

    // Handle moving to a different location
    // FIX: If dropping on a spool in a different location, extract location from overSpool
    let targetLocationName: string;

    if (overSpool && overSpool.location !== draggedSpool.location) {
      // Dropping on a spool in a different location
      targetLocationName = overSpool.location || "unassigned";
    } else {
      // Dropping on a location's droppable zone
      targetLocationName = overId as string;
    }

    // Determine new location value
    let newLocation: string | null = null;

    if (targetLocationName === "unassigned") {
      newLocation = null;
      // Remove from local order when moving to unassigned
      if (draggedSpool.location) {
        setLocalSpoolOrder((prev) => {
          const updated = { ...prev };
          if (updated[draggedSpool.location!]) {
            updated[draggedSpool.location!] = updated[draggedSpool.location!].filter((id) => id !== spoolId);
          }
          return updated;
        });
      }
    } else if (targetLocationName.startsWith("location-")) {
      // Extract location name from the droppable ID
      const locationName = targetLocationName.replace("location-", "");
      newLocation = locationName;

      // Add to local order of new location
      setLocalSpoolOrder((prev) => {
        const updated = { ...prev };

        // Remove from old location if exists
        if (draggedSpool.location && updated[draggedSpool.location]) {
          updated[draggedSpool.location] = updated[draggedSpool.location].filter((id) => id !== spoolId);
        }

        // Add to new location
        if (!updated[locationName]) {
          const existingSpools = spoolsByLocation[locationName] || [];
          updated[locationName] = [...existingSpools.map((s) => s.id), spoolId];
        } else {
          updated[locationName] = [...updated[locationName], spoolId];
        }

        return updated;
      });
    } else {
      // FIX: Handle case where targetLocationName is the actual location name (from overSpool)
      // This happens when dropping on a spool in a different location
      newLocation = targetLocationName;

      // Add to local order of new location
      setLocalSpoolOrder((prev) => {
        const updated = { ...prev };

        // Remove from old location if exists
        if (draggedSpool.location && updated[draggedSpool.location]) {
          updated[draggedSpool.location] = updated[draggedSpool.location].filter((id) => id !== spoolId);
        }

        // Add to new location
        if (!updated[newLocation!]) {
          const existingSpools = spoolsByLocation[newLocation!] || [];
          updated[newLocation!] = [...existingSpools.map((s) => s.id), spoolId];
        } else {
          updated[newLocation!] = [...updated[newLocation!], spoolId];
        }

        return updated;
      });
    }

    // Only update if location changed
    if (draggedSpool.location !== newLocation) {
      // Use debounced update to prevent API overload
      debouncedUpdateSpool(spoolId, newLocation, previousLocation, localOrderSnapshot);
    }
  };

  const activeSpool = spools.find((s) => s.id === activeId);

  if (locationsLoading || spoolsLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (locationsError || spoolsError) {
    return (
      <Box p={3}>
        <Alert severity="error">Failed to load data from Spoolman API. Please check your connection.</Alert>
      </Box>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}>
      <Box p={3}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" component="h1">
            Spool Locations Manager
          </Typography>
          <Box display="flex" gap={2} alignItems="center">
            {!USE_MOCK_DATA && WS_URL && <WebSocketStatus isListening={isListening} />}
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={handleRefresh}>
              Refresh
            </Button>
          </Box>
        </Box>

        {/* Unassigned Spools Section */}
        <Box mb={4}>
          <Typography variant="h5" mb={2}>
            Unassigned Spools ({unassignedSpools.length})
          </Typography>
          <DropZone id="unassigned" spools={unassignedSpools} />
        </Box>

        {/* Locations Section */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h5">Locations ({locations.length})</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateModalOpen(true)}>
            Create Location
          </Button>
        </Box>

        {locations.length === 0 ? (
          <Alert severity="info">No locations found. Create a location to start organizing your spools.</Alert>
        ) : (
          <Grid container spacing={3}>
            {locations.map((location) => (
              <Grid item xs={12} md={6} lg={4} key={location.id}>
                <LocationCard
                  location={location}
                  spools={orderedSpoolsByLocation[location.name] || []}
                  onEdit={() => setEditLocation(location)}
                  onDelete={() => setDeleteLocation(location)}
                />
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      <DragOverlay>{activeSpool ? <SpoolCard spool={activeSpool} isDragging /> : null}</DragOverlay>

      <CreateLocationModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => {
          // Location created via REST API - listen for broadcast
          console.log("[LocationsPage] Location created - listening for broadcast...");
          listenAfterApiCall();
        }}
      />

      {editLocation && (
        <EditLocationModal
          open={!!editLocation}
          onClose={() => setEditLocation(null)}
          location={editLocation}
          onSuccess={() => {
            // Location updated via REST API - listen for broadcast
            console.log("[LocationsPage] Location updated - listening for broadcast...");
            listenAfterApiCall();
          }}
        />
      )}

      {deleteLocation && (
        <DeleteLocationDialog
          open={!!deleteLocation}
          onClose={() => setDeleteLocation(null)}
          location={deleteLocation}
          onSuccess={() => {
            // Location deleted via REST API - listen for broadcast
            console.log("[LocationsPage] Location deleted - listening for broadcast...");
            listenAfterApiCall();
          }}
        />
      )}
    </DndContext>
  );
};

interface DropZoneProps {
  id: string;
  spools: Spool[];
}

const DropZone = ({ id, spools }: DropZoneProps) => {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  return (
    <Card
      ref={setNodeRef}
      sx={{
        border: isOver ? 2 : 0,
        borderColor: "primary.main",
        borderStyle: "dashed",
        backgroundColor: isOver ? "action.hover" : "background.paper",
        transition: "all 0.2s",
      }}>
      <CardContent>
        {spools.length === 0 ? (
          <Box
            sx={{
              p: 3,
              textAlign: "center",
              backgroundColor: isOver ? "primary.light" : "action.hover",
              borderRadius: 1,
              minHeight: 100,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background-color 0.2s",
            }}>
            <Typography color="text.secondary">{isOver ? "Drop here" : "No unassigned spools"}</Typography>
          </Box>
        ) : (
          <Grid container spacing={2}>
            {spools.map((spool) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={spool.id}>
                <DraggableSpoolCard spool={spool} />
              </Grid>
            ))}
          </Grid>
        )}
      </CardContent>
    </Card>
  );
};

interface DraggableSpoolCardProps {
  spool: Spool;
}

const DraggableSpoolCard = ({ spool }: DraggableSpoolCardProps) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: spool.id,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <SpoolCard spool={spool} draggable isDragging={isDragging} />
    </div>
  );
};

interface SortableSpoolCardProps {
  spool: Spool;
}

const SortableSpoolCard = ({ spool }: SortableSpoolCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: spool.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <SpoolCard spool={spool} draggable isDragging={isDragging} />
    </div>
  );
};

interface SpoolCardProps {
  spool: Spool;
  draggable?: boolean;
  isDragging?: boolean;
}

const SpoolCard = ({ spool, draggable = false, isDragging = false }: SpoolCardProps) => {
  const filament = spool.filament;

  // Add null/undefined checks for spool properties
  const remainingWeight = spool.remaining_weight ?? 0;
  const totalWeight = filament?.weight ?? 0;
  const remainingLength = spool.remaining_length ?? null;
  const hasValidLength = remainingLength !== null && remainingLength !== undefined;

  return (
    <Card
      sx={{
        height: "100%",
        cursor: draggable ? "grab" : "default",
        opacity: isDragging ? 0.5 : 1,
        "&:active": draggable ? { cursor: "grabbing" } : {},
        transition: "transform 0.2s, box-shadow 0.2s",
        "&:hover": draggable
          ? {
              transform: "translateY(-2px)",
              boxShadow: 4,
            }
          : {},
      }}>
      <CardContent>
        <Stack spacing={1}>
          <Box display="flex" alignItems="center" gap={1}>
            <Box
              sx={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                backgroundColor: filament?.color_hex || "#cccccc",
                border: "1px solid rgba(0,0,0,0.1)",
                flexShrink: 0,
              }}
            />
            <Typography variant="subtitle2" fontWeight="bold" noWrap>
              {filament?.name || "Unknown Filament"}
            </Typography>
          </Box>

          <Typography variant="body2" color="text.secondary">
            <strong>ID:</strong> #{spool.id}
          </Typography>

          {filament?.vendor && (
            <Typography variant="body2" color="text.secondary" noWrap>
              <strong>Vendor:</strong> {filament.vendor.name}
            </Typography>
          )}

          {filament?.material && <Chip label={filament.material} size="small" sx={{ width: "fit-content" }} />}

          <Typography variant="body2" color="text.secondary">
            <strong>Weight:</strong> {remainingWeight.toFixed(1)}g / {totalWeight}g
          </Typography>

          {hasValidLength && (
            <Typography variant="body2" color="text.secondary">
              <strong>Length:</strong> {(remainingLength / 1000).toFixed(2)}m
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

interface LocationCardProps {
  location: Location;
  spools: Spool[];
  onEdit: () => void;
  onDelete: () => void;
}

const LocationCard = ({ location, spools, onEdit, onDelete }: LocationCardProps) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `location-${location.name}`,
  });

  const spoolIds = spools.map((s) => s.id);

  return (
    <Card
      ref={setNodeRef}
      sx={{
        height: "100%",
        border: isOver ? 2 : 0,
        borderColor: "primary.main",
        borderStyle: "dashed",
        backgroundColor: isOver ? "action.hover" : "background.paper",
        transition: "all 0.2s",
      }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="h6" fontWeight="bold">
              {location.name}
            </Typography>
            <Chip label={`${spools.length} spools`} size="small" color="primary" />
          </Box>
          <Box display="flex" gap={1}>
            <Button
              size="small"
              variant="outlined"
              onClick={onEdit}
              startIcon={<EditIcon />}
              sx={{ minWidth: "auto", px: 1 }}>
              Edit
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="error"
              onClick={onDelete}
              startIcon={<DeleteIcon />}
              sx={{ minWidth: "auto", px: 1 }}>
              Delete
            </Button>
          </Box>
        </Box>

        {spools.length === 0 ? (
          <Box
            sx={{
              p: 3,
              textAlign: "center",
              backgroundColor: isOver ? "primary.light" : "action.hover",
              borderRadius: 1,
              minHeight: 100,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background-color 0.2s",
            }}>
            <Typography color="text.secondary">{isOver ? "Drop spools here" : "Drop spools here"}</Typography>
          </Box>
        ) : (
          <SortableContext items={spoolIds} strategy={verticalListSortingStrategy}>
            <Grid container spacing={2}>
              {spools.map((spool) => (
                <Grid item xs={12} sm={6} key={spool.id}>
                  <SortableSpoolCard spool={spool} />
                </Grid>
              ))}
            </Grid>
          </SortableContext>
        )}
      </CardContent>
    </Card>
  );
};
