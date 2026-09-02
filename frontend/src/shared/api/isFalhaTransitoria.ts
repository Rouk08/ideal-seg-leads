import { ApiError } from './client';

/**
 * Decide se uma falha de requisição é "tente de novo depois" (rede caiu,
 * backend fora do ar, proxy sem conseguir alcançar o serviço) ou um erro de
 * verdade que o vendedor precisa corrigir agora (dado inválido, duplicidade,
 * permissão).
 *
 * Achado testando offline de propósito: matar o backend e deixar o proxy de
 * dev do Vite (ou o nginx em produção) no meio do caminho NÃO produz uma
 * falha de rede crua no fetch — o proxy responde com um 500/502/503/504 de
 * verdade, que cai como ApiError, não como TypeError. Se só falhas de rede
 * "puras" entrassem na fila offline, qualquer instabilidade de
 * backend/proxy (bem mais comum em campo do que ficar 100% sem sinal)
 * mostraria um erro pro vendedor em vez de guardar o cadastro — o oposto do
 * que a regra de negócio #6 pede.
 */
export function isFalhaTransitoria(err: unknown): boolean {
  if (err instanceof ApiError) {
    return err.status >= 500;
  }
  return true; // qualquer coisa que não seja uma resposta HTTP de verdade (TypeError de rede, timeout etc.)
}
