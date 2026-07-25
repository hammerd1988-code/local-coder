import * as React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import EditorPage from "./pages/EditorPage";
import MetricsPage from "./pages/MetricsPage";
import IntegrationsPage from "./pages/IntegrationsPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<EditorPage />} />
        <Route path="/metrics" element={<MetricsPage />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
