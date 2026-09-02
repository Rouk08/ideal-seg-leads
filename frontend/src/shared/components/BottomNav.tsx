import { NavLink } from 'react-router-dom';

export function BottomNav() {
  return (
    <nav className="bottom-nav">
      <NavLink to="/" end>
        <span className="icon">🏠</span>
        Início
      </NavLink>
      <NavLink to="/clientes">
        <span className="icon">📋</span>
        Meus clientes
      </NavLink>
      <NavLink to="/clientes/novo">
        <span className="icon">➕</span>
        Novo cliente
      </NavLink>
    </nav>
  );
}
