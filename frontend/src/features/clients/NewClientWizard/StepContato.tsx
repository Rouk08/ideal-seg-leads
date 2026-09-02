import { TextField } from '../../../shared/components/TextField';
import { formatPhone, onlyDigits } from '../../../shared/format';
import { isValidBrazilianPhone } from '../../../shared/validators/phone';
import type { ClienteFormData } from './draft';

interface Props {
  form: ClienteFormData;
  update: <K extends keyof ClienteFormData>(campo: K, valor: ClienteFormData[K]) => void;
}

export function StepContato({ form, update }: Props) {
  const telefoneInvalido = form.telefone.length > 0 && !isValidBrazilianPhone(form.telefone);
  const whatsappInvalido = form.whatsapp.length > 0 && !isValidBrazilianPhone(form.whatsapp);

  return (
    <div>
      <TextField label="Nome do contato" value={form.nomeContato} onChange={(e) => update('nomeContato', e.target.value)} />
      <TextField label="Cargo" value={form.cargo} onChange={(e) => update('cargo', e.target.value)} />
      <TextField
        label="Telefone"
        inputMode="tel"
        value={formatPhone(form.telefone)}
        onChange={(e) => update('telefone', onlyDigits(e.target.value))}
        error={telefoneInvalido ? 'Telefone inválido' : undefined}
      />
      <TextField
        label="WhatsApp"
        inputMode="tel"
        hint="Se for igual ao telefone, pode repetir o mesmo número"
        value={formatPhone(form.whatsapp)}
        onChange={(e) => update('whatsapp', onlyDigits(e.target.value))}
        error={whatsappInvalido ? 'WhatsApp inválido' : undefined}
      />
      <TextField label="E-mail" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
    </div>
  );
}
