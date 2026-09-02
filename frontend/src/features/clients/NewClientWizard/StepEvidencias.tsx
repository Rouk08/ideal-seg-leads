import { useState } from 'react';
import imageCompression from 'browser-image-compression';
import { TextAreaField } from '../../../shared/components/TextField';
import { Button } from '../../../shared/components/Button';
import type { ClienteFormData } from './draft';

interface Props {
  form: ClienteFormData;
  update: <K extends keyof ClienteFormData>(campo: K, valor: ClienteFormData[K]) => void;
  foto: File | null;
  onFotoChange: (file: File | null) => void;
}

export function StepEvidencias({ form, update, foto, onFotoChange }: Props) {
  const [capturandoLocal, setCapturandoLocal] = useState(false);
  const [erroLocal, setErroLocal] = useState('');
  const [comprimindo, setComprimindo] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  function capturarLocalizacao() {
    if (!navigator.geolocation) {
      setErroLocal('Geolocalização não é suportada neste dispositivo.');
      return;
    }
    setErroLocal('');
    setCapturandoLocal(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        update('latitude', pos.coords.latitude);
        update('longitude', pos.coords.longitude);
        setCapturandoLocal(false);
      },
      (err) => {
        setErroLocal(err.message || 'Não foi possível obter a localização. Verifique a permissão do app.');
        setCapturandoLocal(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function onSelecionarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setComprimindo(true);
    try {
      // Comprime no aparelho ANTES de subir — importante em campo, onde a
      // conexão costuma ser fraca/cara. Alvo: ~1MB, lado máximo 1600px.
      const comprimido = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
      });
      onFotoChange(comprimido);
      setPreviewUrl(URL.createObjectURL(comprimido));
    } catch {
      // se a compressão falhar por algum motivo, usa o arquivo original —
      // o backend ainda valida tamanho/formato antes de aceitar
      onFotoChange(file);
      setPreviewUrl(URL.createObjectURL(file));
    } finally {
      setComprimindo(false);
    }
  }

  return (
    <div>
      <div className="field">
        <label>Localização da visita</label>
        {form.latitude && form.longitude ? (
          <div className="alert alert-success">
            Localização registrada ({form.latitude.toFixed(5)}, {form.longitude.toFixed(5)})
          </div>
        ) : (
          <Button type="button" variant="secondary" block onClick={capturarLocalizacao} disabled={capturandoLocal}>
            {capturandoLocal ? 'Obtendo localização…' : '📍 Capturar localização atual'}
          </Button>
        )}
        {erroLocal ? <div className="alert alert-danger" style={{ marginTop: 'var(--space-2)' }}>{erroLocal}</div> : null}
      </div>

      <div className="field">
        <label>Foto da fachada (opcional)</label>
        <input type="file" accept="image/*" capture="environment" onChange={onSelecionarFoto} />
        {comprimindo ? <span className="field-hint">Comprimindo imagem…</span> : null}
        {previewUrl ? (
          <img src={previewUrl} alt="Prévia da foto da fachada" style={{ marginTop: 8, maxWidth: '100%', borderRadius: 'var(--radius-sm)' }} />
        ) : null}
        {foto ? (
          <span className="field-hint">
            {(foto.size / 1024).toFixed(0)} KB — pronta para envio
          </span>
        ) : null}
      </div>

      <TextAreaField label="Observações" value={form.observacoes} onChange={(e) => update('observacoes', e.target.value)} />

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={form.consentimentoLgpd}
          onChange={(e) => update('consentimentoLgpd', e.target.checked)}
        />
        O cliente autorizou o uso destes dados para contato comercial (LGPD)
      </label>
    </div>
  );
}
