import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../shared/auth/AuthContext';
import logo from '../../assets/logo.webp';

export function AdminLayout() {
  const { usuario, logout } = useAuth();

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <span className="brand">
          <img src={logo} alt="" width={28} height={28} />
          Ideal Seg
        </span>
        <nav>
          <NavLink to="/admin" end>
            Dashboard
          </NavLink>
          <NavLink to="/admin/clientes">Clientes</NavLink>
          <NavLink to="/admin/usuarios">Usuários</NavLink>
          {usuario?.perfil === 'ADMIN' ? <NavLink to="/admin/parametros">Parâmetros</NavLink> : null}
        </nav>
        <span style={{ fontSize: 14, opacity: 0.85 }}>{usuario?.nome}</span>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ color: 'white', minHeight: 'auto', padding: '4px 10px' }}
          onClick={() => logout()}
        >
          Sair
        </button>
      </header>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
