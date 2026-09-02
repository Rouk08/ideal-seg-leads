import { TextField } from '../../../shared/components/TextField';
import { SelectField } from '../../../shared/components/SelectField';
import { CheckboxGroup } from '../../../shared/components/CheckboxGroup';
import { ESCALA_LABEL, SERVICOS_INTERESSE_LABEL, TURNO_LABEL, type Escala, type ServicoInteresse, type Turno } from '../../../shared/types';
import type { ClienteFormData } from './draft';

interface Props {
  form: ClienteFormData;
  update: <K extends keyof ClienteFormData>(campo: K, valor: ClienteFormData[K]) => void;
}

export function StepQualificacao({ form, update }: Props) {
  return (
    <div>
      <CheckboxGroup<ServicoInteresse>
        label="Serviços de interesse"
        options={(Object.keys(SERVICOS_INTERESSE_LABEL) as ServicoInteresse[]).map((v) => ({
          value: v,
          label: SERVICOS_INTERESSE_LABEL[v],
        }))}
        selected={form.servicosInteresse}
        onChange={(v) => update('servicosInteresse', v)}
      />

      <TextField
        label="Quantidade de postos"
        type="number"
        min={1}
        value={form.qtdPostos}
        onChange={(e) => update('qtdPostos', e.target.value)}
      />

      <SelectField
        label="Escala"
        placeholder="Selecione"
        options={(Object.keys(ESCALA_LABEL) as Escala[]).map((v) => ({ value: v, label: ESCALA_LABEL[v] }))}
        value={form.escala}
        onChange={(e) => update('escala', e.target.value as Escala | '')}
      />
      {form.escala === 'OUTRA' ? (
        <TextField
          label="Detalhe da escala"
          value={form.escalaOutraDescricao}
          onChange={(e) => update('escalaOutraDescricao', e.target.value)}
        />
      ) : null}

      <SelectField
        label="Turno"
        placeholder="Selecione"
        options={(Object.keys(TURNO_LABEL) as Turno[]).map((v) => ({ value: v, label: TURNO_LABEL[v] }))}
        value={form.turno}
        onChange={(e) => update('turno', e.target.value as Turno | '')}
      />

      <TextField
        label="Concorrente atual"
        value={form.concorrenteAtual}
        onChange={(e) => update('concorrenteAtual', e.target.value)}
      />

      <TextField
        label="Valor estimado mensal (R$)"
        type="number"
        min={0}
        step="0.01"
        value={form.valorEstimadoMensal}
        onChange={(e) => update('valorEstimadoMensal', e.target.value)}
      />

      <TextField
        label="Previsão de decisão"
        type="date"
        value={form.previsaoDecisao}
        onChange={(e) => update('previsaoDecisao', e.target.value)}
      />
    </div>
  );
}
