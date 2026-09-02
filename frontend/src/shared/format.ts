export function onlyDigits(value: string): string {
  return (value ?? '').replace(/\D/g, '');
}

export function formatCpfCnpj(value: string): string {
  const digits = onlyDigits(value);
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return digits
    .slice(0, 14)
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export function formatPhone(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, (_m, a, b, c) => (c ? `(${a}) ${b}-${c}` : b ? `(${a}) ${b}` : `(${a}`));
  }
  return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, (_m, a, b, c) => (c ? `(${a}) ${b}-${c}` : `(${a}) ${b}`));
}

export function formatCep(value: string): string {
  return onlyDigits(value).slice(0, 8).replace(/(\d{5})(\d{1,3})/, '$1-$2');
}

export function whatsappLink(phone: string, message?: string): string {
  const digits = onlyDigits(phone);
  const withCountry = digits.startsWith('55') ? digits : `55${digits}`;
  const base = `https://wa.me/${withCountry}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function formatDateBR(iso?: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(iso));
}

export function formatDateTimeBR(iso?: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
}

export function formatCurrencyBRL(value?: string | number | null): string {
  if (value === undefined || value === null || value === '') return '—';
  const num = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(num)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
}
