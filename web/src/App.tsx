
import React, { Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { getCurrentUserRole, getAuthToken } from "./lib/api";

// Load each page only when it is needed
const Login = React.lazy(() =>
  import("./pages/Login").then((module) => ({ default: module.Login }))
);

const Benchmark = React.lazy(() =>
  import("./pages/Benchmark").then((module) => ({ default: module.Benchmark }))
);

const SalesmanWorkspace = React.lazy(() =>
  import("./pages/SalesmanWorkspace").then((module) => ({
    default: module.SalesmanWorkspace,
  }))
);

const AdminWorkspace = React.lazy(() =>
  import("./pages/AdminWorkspace").then((module) => ({
    default: module.AdminWorkspace,
  }))
);

const ProductionWorkspace = React.lazy(() =>
  import("./pages/ProductionWorkspace").then((module) => ({
    default: module.ProductionWorkspace,
  }))
);

const AuditorWorkspace = React.lazy(() =>
  import("./pages/AuditorWorkspace").then((module) => ({
    default: module.AuditorWorkspace,
  }))
);

const OwnerWorkspace = React.lazy(() =>
  import("./pages/OwnerWorkspace").then((module) => ({
    default: module.OwnerWorkspace,
  }))
);

const PublicTrace = React.lazy(() =>
  import("./pages/PublicTrace").then((module) => ({
    default: module.PublicTrace,
  }))
);

const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  allowedRoles?: string[];
}> = ({ children, allowedRoles }) => {
  const token = getAuthToken();
  const role = getCurrentUserRole();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
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
      <Suspense
        fallback={
          <div
            style={{
              minHeight: "100vh",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "sans-serif",
              color: "#64748b",
            }}
          >
            Loading Batchly...
          </div>
        }
      >
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/benchmark"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <Benchmark />
              </ProtectedRoute>
            }
          />
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
      </Suspense>
    </Router>
  );
};

export default App;
