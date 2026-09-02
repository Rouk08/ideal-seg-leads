import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../../shared/api/client';
import type { Settings } from '../../shared/types';
import { TextField } from '../../shared/components/TextField';
import { Button } from '../../shared/components/Button';

export function SettingsPage() {
  const [diasReservaCarteira, setDiasReservaCarteira] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api
      .get<Settings>('/settings')
      .then((s) => setDiasReservaCarteira(String(s.diasReservaCarteira)))
      .finally(() => setCarregando(false));
  }, []);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setSucesso(false);
    setSalvando(true);
    try {
      await api.patch('/settings', { diasReservaCarteira: Number(diasReservaCarteira) });
      setSucesso(true);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return <p>Carregando…</p>;

  return (
    <div>
      <h2>Parâmetros</h2>
      <p className="field-hint">
        Configurações gerais do sistema — afetam todo o time, não um vendedor específico (metas e comissão são
        individuais e ficam na tela de Usuários).
      </p>

      <form onSubmit={salvar} style={{ maxWidth: 360 }}>
        {sucesso ? <div className="alert alert-success">Salvo com sucesso.</div> : null}
        {erro ? <div className="alert alert-danger">{erro}</div> : null}
        <TextField
          label="Dias de reserva de carteira"
          type="number"
          min={1}
          max={365}
          required
          hint="Por quantos dias um lead fica exclusivo do vendedor que cadastrou, sem interação registrada, antes de poder ser reatribuído."
          value={diasReservaCarteira}
          onChange={(e) => setDiasReservaCarteira(e.target.value)}
        />
        <Button type="submit" disabled={salvando}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </Button>
      </form>
    </div>
  );
}
