import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './shared/auth/AuthContext';
import { RequireAuth } from './shared/auth/RequireAuth';
import { useAuth } from './shared/auth/AuthContext';
import { LoginPage } from './features/auth/LoginPage';
import { AcceptInvitePage } from './features/auth/AcceptInvitePage';
import { HomePage } from './features/home/HomePage';
import { ClientsListPage } from './features/clients/ClientsListPage';
import { ClientDetailPage } from './features/clients/ClientDetailPage';
import { NewClientWizard } from './features/clients/NewClientWizard';
import { AdminLayout } from './features/admin/AdminLayout';
import { DashboardPage } from './features/admin/DashboardPage';
import { ClientsAdminListPage } from './features/admin/ClientsAdminListPage';
import { UsersPage } from './features/admin/UsersPage';
import { SettingsPage } from './features/admin/SettingsPage';

// Vendedor cai na Home mobile; supervisor/admin caem direto no dashboard
// desktop — são públicos completamente diferentes, não faz sentido os dois
// disputarem a mesma tela inicial "/".
function RaizPorPerfil() {
  const { usuario } = useAuth();
  if (usuario?.perfil === 'VENDEDOR') return <HomePage />;
  return <Navigate to="/admin" replace />;
}

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
                <RaizPorPerfil />
              </RequireAuth>
            }
          />
          <Route
            path="/clientes"
            element={
              <RequireAuth perfis={['VENDEDOR']}>
                <ClientsListPage />
              </RequireAuth>
            }
          />
          <Route
            path="/clientes/novo"
            element={
              <RequireAuth perfis={['VENDEDOR']}>
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

          <Route
            path="/admin"
            element={
              <RequireAuth perfis={['SUPERVISOR', 'ADMIN']}>
                <AdminLayout />
              </RequireAuth>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="clientes" element={<ClientsAdminListPage />} />
            <Route path="clientes/:id" element={<ClientDetailPage />} />
            <Route path="usuarios" element={<UsersPage />} />
            <Route
              path="parametros"
              element={
                <RequireAuth perfis={['ADMIN']}>
                  <SettingsPage />
                </RequireAuth>
              }
            />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
