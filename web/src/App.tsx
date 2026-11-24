import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Login } from "./pages/Login";
import { Benchmark } from "./pages/Benchmark";
import { SalesmanWorkspace } from "./pages/SalesmanWorkspace";
import { AdminWorkspace } from "./pages/AdminWorkspace";
import { ProductionWorkspace } from "./pages/ProductionWorkspace";
import { AuditorWorkspace } from "./pages/AuditorWorkspace";
import { OwnerWorkspace } from "./pages/OwnerWorkspace";
import { PublicTrace } from "./pages/PublicTrace";
import { getCurrentUserRole, getAuthToken } from "./lib/api";

const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({ children, allowedRoles }) => {
  const token = getAuthToken();
  const role = getCurrentUserRole();

  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    // If not authorized for this specific workspace, redirect to user's home
    if (role === "SALESMAN") return <Navigate to="/salesman" replace />;
    if (role === "PRODUCTION") return <Navigate to="/production" replace />;
    if (role === "AUDITOR") return <Navigate to="/auditor" replace />;
    if (role === "OWNER") return <Navigate to="/owner" replace />;
    return <Navigate to="/admin" replace />;
  }
  return <>{children}</>;
};

const RootRedirect: React.FC = () => {
  const role = getCurrentUserRole();
  if (!role) return <Navigate to="/login" replace />;
  if (role === "SALESMAN") return <Navigate to="/salesman" replace />;
  if (role === "PRODUCTION") return <Navigate to="/production" replace />;
  if (role === "AUDITOR") return <Navigate to="/auditor" replace />;
  if (role === "OWNER") return <Navigate to="/owner" replace />;
  return <Navigate to="/admin" replace />;
};

export const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/benchmark" element={<Benchmark />} />
        <Route path="/t/:batch_no" element={<PublicTrace />} />

        {/* Role Workspaces */}
        <Route
          path="/salesman"
          element={
            <ProtectedRoute allowedRoles={["SALESMAN", "ADMIN"]}>
              <SalesmanWorkspace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <AdminWorkspace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/production"
          element={
            <ProtectedRoute allowedRoles={["PRODUCTION", "ADMIN"]}>
              <ProductionWorkspace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/auditor"
          element={
            <ProtectedRoute allowedRoles={["AUDITOR", "ADMIN"]}>
              <AuditorWorkspace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/owner"
          element={
            <ProtectedRoute allowedRoles={["OWNER", "ADMIN"]}>
              <OwnerWorkspace />
            </ProtectedRoute>
          }
        />

        <Route path="/" element={<RootRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default App;
