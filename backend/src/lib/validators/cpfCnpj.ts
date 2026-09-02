// Validação real de CPF/CNPJ (dígito verificador), não apenas formato/tamanho.
// Isso é o que impede, por exemplo, "111.111.111-11" ou uma sequência
// aleatória de 11 dígitos de passar como CPF válido.

export function onlyDigits(value: string): string {
  return (value ?? '').replace(/\D/g, '');
}

function hasAllSameDigits(digits: string): boolean {
  return /^(\d)\1+$/.test(digits);
}

export function isValidCpf(rawValue: string): boolean {
  const cpf = onlyDigits(rawValue);
  if (cpf.length !== 11 || hasAllSameDigits(cpf)) return false;

  const digits = cpf.split('').map(Number);

  const calcCheckDigit = (base: number[]): number => {
    const factorStart = base.length + 1;
    const sum = base.reduce((acc, digit, i) => acc + digit * (factorStart - i), 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const dv1 = calcCheckDigit(digits.slice(0, 9));
  const dv2 = calcCheckDigit(digits.slice(0, 9).concat(dv1));

  return digits[9] === dv1 && digits[10] === dv2;
}

export function isValidCnpj(rawValue: string): boolean {
  const cnpj = onlyDigits(rawValue);
  if (cnpj.length !== 14 || hasAllSameDigits(cnpj)) return false;

  const digits = cnpj.split('').map(Number);

  const calcCheckDigit = (base: number[]): number => {
    const weights = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = base.reduce((acc, digit, i) => acc + digit * weights[i], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const dv1 = calcCheckDigit(digits.slice(0, 12));
  const dv2 = calcCheckDigit(digits.slice(0, 12).concat(dv1));

  return digits[12] === dv1 && digits[13] === dv2;
}

/** Valida CPF ou CNPJ conforme o tipo de pessoa informado. */
export function isValidCpfCnpj(rawValue: string, tipoPessoa: 'PF' | 'PJ'): boolean {
  return tipoPessoa === 'PF' ? isValidCpf(rawValue) : isValidCnpj(rawValue);
}
