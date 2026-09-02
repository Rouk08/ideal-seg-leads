import { ServicoInteresse } from '@prisma/client';

// Espelha frontend/src/shared/types.ts (SERVICOS_INTERESSE_LABEL) — usado só
// pra compor um texto legível quando o cliente é encaminhado pro ERP (campo
// "notes" do Client de lá). Mantido manualmente em sincronia, igual o resto
// dos enums espelhados neste projeto.
export const SERVICOS_INTERESSE_LABEL: Record<ServicoInteresse, string> = {
  PORTARIA_CONTROLE_ACESSO: 'Portaria / controle de acesso',
  VIGILANCIA_PATRIMONIAL: 'Vigilância patrimonial',
  LIMPEZA_HIGIENIZACAO: 'Limpeza e higienização',
  MANUTENCAO_PREDIAL: 'Manutenção predial',
  CONSULTORIA_SEGURANCA: 'Consultoria em segurança',
  MONITORAMENTO: 'Monitoramento',
};
