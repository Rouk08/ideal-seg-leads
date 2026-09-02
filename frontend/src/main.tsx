import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { iniciarSincronizacaoAutomatica } from './offline/syncQueue';
import './styles/global.css';
import './shared/components/components.css';

iniciarSincronizacaoAutomatica();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
