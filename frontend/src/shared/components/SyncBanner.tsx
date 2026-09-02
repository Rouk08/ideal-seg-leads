import { useSyncQueue } from '../../offline/useSyncQueue';

/** Indicador visual de cadastros/interações pendentes de sincronização —
 * regra de negócio #6 ("indicador visual claro de X cadastros pendentes"). */
export function SyncBanner() {
  const { pendentes, comErro, tentarAgora } = useSyncQueue();

  if (pendentes === 0) return null;

  return (
    <div className={`alert ${comErro > 0 ? 'alert-danger' : 'alert-info'}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span>
        ⏳ {pendentes} {pendentes === 1 ? 'cadastro pendente' : 'cadastros pendentes'} de sincronização
        {comErro > 0 ? ` (${comErro} com erro)` : ''}
      </span>
      <button type="button" className="btn btn-ghost" style={{ minHeight: 'auto', padding: '4px 8px' }} onClick={tentarAgora}>
        Tentar agora
      </button>
    </div>
  );
}
