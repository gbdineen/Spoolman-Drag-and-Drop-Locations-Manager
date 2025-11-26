import { useDelete, useUpdate, useList, useNotification } from "@refinedev/core";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Alert, Box } from "@mui/material";
import { useState } from "react";
import type { Location, Spool } from "../../types";

interface DeleteLocationDialogProps {
  open: boolean;
  onClose: () => void;
  location: Location;
  onSuccess?: () => void;
}

export const DeleteLocationDialog = ({ open, onClose, location, onSuccess }: DeleteLocationDialogProps) => {
  const { mutate: deleteLocation, isLoading: isDeleting } = useDelete();
  const { mutate: updateSpool } = useUpdate();
  const { open: openNotification } = useNotification();
  const [error, setError] = useState<string | null>(null);

  // Get all spools to check which ones are in this location
  const { data: spoolsData } = useList<Spool>({
    resource: "spool",
    pagination: {
      mode: "off",
    },
    queryOptions: {
      enabled: open, // Only fetch when dialog is open
    },
  });

  const spools = spoolsData?.data ?? [];
  const affectedSpools = spools.filter((spool) => spool.location === location.name);

  const handleDelete = async () => {
    setError(null);

    try {
      // First, move all spools to unassigned
      if (affectedSpools.length > 0) {
        const updatePromises = affectedSpools.map(
          (spool) =>
            new Promise<void>((resolve, reject) => {
              updateSpool(
                {
                  resource: "spool",
                  id: spool.id,
                  values: {
                    location: null,
                  },
                  successNotification: false, // Don't show individual notifications
                  errorNotification: false,
                },
                {
                  onSuccess: () => resolve(),
                  onError: (error) => reject(error),
                },
              );
            }),
        );

        // Wait for all spools to be updated
        await Promise.all(updatePromises);
      }

      // Then delete the location
      deleteLocation(
        {
          resource: "location",
          id: location.id,
          successNotification: {
            message: "Location deleted successfully",
            description:
              affectedSpools.length > 0 ? `${affectedSpools.length} spool(s) moved to unassigned` : undefined,
            type: "success",
          },
          errorNotification: false,
        },
        {
          onSuccess: () => {
            onClose();
            onSuccess?.();
          },
          onError: (error) => {
            console.error("Delete location error:", error);
            setError("Failed to delete location. Please try again.");
            openNotification?.({
              type: "error",
              message: "Failed to delete location",
              description: "Please try again or check your connection.",
            });
          },
        },
      );
    } catch (error) {
      console.error("Failed to move spools:", error);
      setError("Failed to move spools to unassigned area. Location was not deleted.");
      openNotification?.({
        type: "error",
        message: "Failed to move spools",
        description: "Could not reassign spools. Location was not deleted.",
      });
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Delete Location</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Typography>
            Are you sure you want to delete the location <strong>"{location.name}"</strong>?
          </Typography>
        </Box>

        {affectedSpools.length > 0 && (
          <Alert severity="warning" sx={{ mb: error ? 2 : 0 }}>
            This location contains <strong>{affectedSpools.length}</strong> spool(s). They will be moved to the
            unassigned area.
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isDeleting}>
          Cancel
        </Button>
        <Button onClick={handleDelete} variant="contained" color="error" disabled={isDeleting}>
          {isDeleting ? "Deleting..." : "Delete"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
