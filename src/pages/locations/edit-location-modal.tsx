import { useForm } from "@refinedev/react-hook-form";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Box } from "@mui/material";
import type { Location } from "../../types";

interface EditLocationModalProps {
  open: boolean;
  onClose: () => void;
  location: Location;
  onSuccess?: () => void;
}

export const EditLocationModal = ({ open, onClose, location, onSuccess }: EditLocationModalProps) => {
  const {
    refineCore: { onFinish, formLoading },
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<Location>({
    refineCoreProps: {
      resource: "location",
      action: "edit",
      id: location.id,
      redirect: false,
      successNotification: {
        message: "Location updated successfully",
        type: "success",
      },
      errorNotification: {
        message: "Failed to update location",
        description: "Please check your input and try again.",
        type: "error",
      },
      onMutationSuccess: () => {
        reset();
        onClose();
        onSuccess?.();
      },
      onMutationError: (error) => {
        console.error("Edit location error:", error);
        // Form stays open so user can correct the error
      },
    },
    defaultValues: {
      name: location.name,
    },
  });

  const onSubmit = (data: any) => {
    onFinish(data);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle>Edit Location</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              {...register("name", {
                required: "Location name is required",
                minLength: {
                  value: 1,
                  message: "Location name cannot be empty",
                },
              })}
              label="Location Name"
              fullWidth
              autoFocus
              error={!!errors.name}
              helperText={errors.name?.message as string}
              disabled={formLoading}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={formLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={formLoading}>
            {formLoading ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
