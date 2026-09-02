import { randomBytes, createHash } from 'node:crypto';

/**
 * Gera um token de uso único (convite, refresh token) e retorna as duas
 * formas que interessam:
 *   - raw: vai para fora do sistema (link enviado, cookie do cliente) e
 *     NUNCA é persistido.
 *   - hash: o que fica salvo no banco, para comparação posterior.
 * Isso garante que um vazamento do banco não permite reconstruir tokens
 * válidos (mesmo princípio de senha, aplicado a tokens de uso único).
 */
export function generateOpaqueToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString('base64url');
  return { raw, hash: hashOpaqueToken(raw) };
}

export function hashOpaqueToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
