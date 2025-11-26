import { useForm } from "@refinedev/react-hook-form";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Box } from "@mui/material";
import type { Location } from "../../types";

interface CreateLocationModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CreateLocationModal = ({ open, onClose, onSuccess }: CreateLocationModalProps) => {
  const {
    refineCore: { onFinish, formLoading },
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<Location>({
    refineCoreProps: {
      resource: "location",
      action: "create",
      redirect: false,
      successNotification: {
        message: "Location created successfully",
        type: "success",
      },
      errorNotification: {
        message: "Failed to create location",
        description: "Please check your input and try again.",
        type: "error",
      },
      onMutationSuccess: () => {
        reset();
        onClose();
        onSuccess?.();
      },
      onMutationError: (error) => {
        console.error("Create location error:", error);
        // Form stays open so user can correct the error
      },
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
        <DialogTitle>Create New Location</DialogTitle>
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
            {formLoading ? "Creating..." : "Create"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
