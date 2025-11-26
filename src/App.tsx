import { Refine, WelcomePage } from "@refinedev/core";
import CssBaseline from "@mui/material/CssBaseline";
import GlobalStyles from "@mui/material/GlobalStyles";
import routerBindings, { NavigateToResource } from "@refinedev/react-router";
import { BrowserRouter, Routes, Route, Outlet } from "react-router";
import { createDataProvider } from "./providers/data";
import { LocationsPage } from "./pages/locations";
import { RefineSnackbarProvider, useNotificationProvider } from "@refinedev/mui";

const API_URL = import.meta.env.VITE_SPOOLMAN_API_URL || "http://192.168.8.228:7912/api/v1";
const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === "true" || !import.meta.env.VITE_SPOOLMAN_API_URL;

console.log("Environment variables:", {
  VITE_USE_MOCK_DATA: import.meta.env.VITE_USE_MOCK_DATA,
  VITE_SPOOLMAN_API_URL: import.meta.env.VITE_SPOOLMAN_API_URL,
  USE_MOCK_DATA,
  API_URL,
});

const App = () => {
  return (
    <BrowserRouter>
      <CssBaseline />
      <GlobalStyles styles={{ html: { WebkitFontSmoothing: "auto" } }} />
      <RefineSnackbarProvider>
        <Refine
          routerProvider={routerBindings}
          dataProvider={createDataProvider(USE_MOCK_DATA, API_URL)}
          notificationProvider={useNotificationProvider}
          resources={[
            {
              name: "location",
              list: "/",
            },
            {
              name: "spool",
            },
          ]}>
          <Routes>
            <Route index element={<LocationsPage />} />
          </Routes>
        </Refine>
      </RefineSnackbarProvider>
    </BrowserRouter>
  );
};

export default App;
