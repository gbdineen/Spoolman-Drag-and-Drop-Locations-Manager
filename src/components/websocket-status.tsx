import { Box, Chip, Tooltip, IconButton } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";

/**
 * WebSocket Status Indicator (On-Demand Model)
 * Shows when the app is actively listening for broadcasts
 */

interface Props {
  isListening: boolean;
  onReconnect?: () => void;
}

export const WebSocketStatus = ({ isListening, onReconnect }: Props) => {
  return (
    <Box display="flex" alignItems="center" gap={1}>
      <Tooltip title={isListening ? "Listening for broadcast..." : "WebSocket ready (on-demand)"}>
        <Chip
          size="small"
          icon={<FiberManualRecordIcon sx={{ fontSize: "12px !important" }} />}
          label={isListening ? "Listening" : "Ready"}
          color={isListening ? "success" : "default"}
          sx={{
            "& .MuiChip-icon": {
              animation: isListening ? "pulse 2s infinite" : "none",
            },
            "@keyframes pulse": {
              "0%, 100%": { opacity: 1 },
              "50%": { opacity: 0.5 },
            },
          }}
        />
      </Tooltip>
      {onReconnect && !isListening && (
        <Tooltip title="Manually trigger connection test">
          <IconButton size="small" onClick={onReconnect} sx={{ ml: 0.5 }}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
};
