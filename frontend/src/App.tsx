import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './shared/auth/AuthContext';
import { RequireAuth } from './shared/auth/RequireAuth';
import { LoginPage } from './features/auth/LoginPage';
import { AcceptInvitePage } from './features/auth/AcceptInvitePage';
import { HomePage } from './features/home/HomePage';
import { ClientsListPage } from './features/clients/ClientsListPage';
import { ClientDetailPage } from './features/clients/ClientDetailPage';
import { NewClientWizard } from './features/clients/NewClientWizard';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/aceitar-convite" element={<AcceptInvitePage />} />

          <Route
            path="/"
            element={
              <RequireAuth>
                <HomePage />
              </RequireAuth>
            }
          />
          <Route
            path="/clientes"
            element={
              <RequireAuth>
                <ClientsListPage />
              </RequireAuth>
            }
          />
          <Route
            path="/clientes/novo"
            element={
              <RequireAuth>
                <NewClientWizard />
              </RequireAuth>
            }
          />
          <Route
            path="/clientes/:id"
            element={
              <RequireAuth>
                <ClientDetailPage />
              </RequireAuth>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
