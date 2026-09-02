import { onlyDigits } from './cpfCnpj';

// Telefone brasileiro: DDD (2 dígitos, 11-99) + número (8 dígitos fixo, ou
// 9 dígitos celular começando com 9). Aceita com ou sem o "55" do país.
export function isValidBrazilianPhone(rawValue: string): boolean {
  let digits = onlyDigits(rawValue);
  if (digits.length === 12 || digits.length === 13) {
    if (digits.startsWith('55')) digits = digits.slice(2);
  }

  if (digits.length !== 10 && digits.length !== 11) return false;

  const ddd = Number(digits.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;

  if (digits.length === 11 && digits[2] !== '9') return false;

  return true;
}
