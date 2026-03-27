import { createRoot } from "react-dom/client";
import { Router, Route, Switch, Redirect } from "wouter";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LandingPage from "./pages/LandingPage";
import AppShell from "./pages/AppShell";
import AdminPage from "./pages/AdminPage";
import "./index.css";
import "./App.css";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { investor, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#2b2b2b',
        color: '#B0B0B0',
        fontSize: 16,
      }}>
        Loading…
      </div>
    );
  }

  if (!investor) {
    return <Redirect to="/" />;
  }

  return <>{children}</>;
}

function Root() {
  return (
    <AuthProvider>
      <Router>
        <Switch>
          <Route path="/">
            <LandingPage />
          </Route>
          <Route path="/app/:rest*">
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          </Route>
          <Route path="/app">
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          </Route>
          <Route path="/admin">
            <AdminPage />
          </Route>
          <Route>
            <Redirect to="/" />
          </Route>
        </Switch>
      </Router>
    </AuthProvider>
  );
}

createRoot(document.getElementById("root")!).render(<Root />);
