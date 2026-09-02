import { prisma } from './prisma';

interface RecordAuditInput {
  usuarioId?: string | null;
  acao: string; // ex.: "usuario.login", "convite.criar", "convite.aceitar"
  entidade: string; // ex.: "Usuario", "Invite"
  entidadeId?: string | null;
  antes?: unknown;
  depois?: unknown;
  ip?: string | null;
}

/**
 * Grava uma linha de auditoria. Chamado explicitamente pelos serviços nos
 * pontos que importam (login, criação/edição de cliente, reatribuição,
 * desativação de usuário etc.) — em vez de um middleware genérico, que não
 * teria como saber o "antes" de forma confiável nem descrever a ação.
 *
 * Nunca deve derrubar a operação principal: um problema ao gravar auditoria
 * é logado no console e engolido, não propagado como erro 500 pro usuário.
 */
export async function recordAudit(input: RecordAuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        usuarioId: input.usuarioId ?? null,
        acao: input.acao,
        entidade: input.entidade,
        entidadeId: input.entidadeId ?? null,
        antes: input.antes === undefined ? undefined : (input.antes as any),
        depois: input.depois === undefined ? undefined : (input.depois as any),
        ip: input.ip ?? null,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[audit] falha ao gravar log de auditoria', err);
  }
}
