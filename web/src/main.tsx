import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import App from "./App";
import Watchlist from "./routes/Watchlist";
import MarketPulse from "./routes/MarketPulse";
import RegulatoryRadar from "./routes/RegulatoryRadar";
import InstrumentDetail from "./routes/InstrumentDetail";
import Alerts from "./routes/Alerts";
import Sources from "./routes/Sources";
import Search from "./routes/Search";
import "./index.css";

const qc = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 10_000 } },
});

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Watchlist /> },
      { path: "pulse", element: <MarketPulse /> },
      { path: "radar", element: <RegulatoryRadar /> },
      { path: "stock/:symbol", element: <InstrumentDetail /> },
      { path: "alerts", element: <Alerts /> },
      { path: "sources", element: <Sources /> },
      { path: "search", element: <Search /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>
);
