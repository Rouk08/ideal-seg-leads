import { useNavigate } from 'react-router-dom';

export function TopBar({ title, back }: { title: string; back?: boolean }) {
  const navigate = useNavigate();
  return (
    <header className="top-bar">
      {back ? (
        <button className="top-bar-back" onClick={() => navigate(-1)} aria-label="Voltar">
          ←
        </button>
      ) : null}
      <h1>{title}</h1>
    </header>
  );
}
