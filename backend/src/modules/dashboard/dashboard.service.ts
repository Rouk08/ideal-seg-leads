import { Perfil } from '@prisma/client';
import { prisma } from '../../lib/prisma';

/**
 * Agregação simples em memória (JS), não SQL — no volume de dados desta
 * fase (uma equipe de vendedores, não milhares de linhas) isso é rápido o
 * bastante e muito mais fácil de ler/ajustar do que um groupBy complexo.
 * Se o volume crescer bastante, vira candidato a otimização.
 */
export async function getStats() {
  const [clientes, vendedores] = await Promise.all([
    prisma.cliente.findMany({
      select: { vendedorId: true, etapaFunil: true, dataCadastro: true },
    }),
    prisma.usuario.findMany({
      where: { perfil: Perfil.VENDEDOR },
      select: { id: true, nome: true, ativo: true },
    }),
  ]);

  const porEtapa: Record<string, number> = {};
  for (const c of clientes) {
    porEtapa[c.etapaFunil] = (porEtapa[c.etapaFunil] ?? 0) + 1;
  }

  const hoje = new Date();
  const cadastrosNoMes = clientes.filter(
    (c) => c.dataCadastro.getMonth() === hoje.getMonth() && c.dataCadastro.getFullYear() === hoje.getFullYear(),
  ).length;

  const porVendedorMap = new Map<string, { total: number; ganho: number; perdido: number }>();
  for (const v of vendedores) {
    porVendedorMap.set(v.id, { total: 0, ganho: 0, perdido: 0 });
  }
  for (const c of clientes) {
    const entry = porVendedorMap.get(c.vendedorId);
    if (!entry) continue; // cliente de um vendedor que não existe mais/mudou de perfil — não deveria acontecer, mas não derruba o dashboard
    entry.total += 1;
    if (c.etapaFunil === 'GANHO') entry.ganho += 1;
    if (c.etapaFunil === 'PERDIDO') entry.perdido += 1;
  }

  const porVendedor = vendedores.map((v) => {
    const stats = porVendedorMap.get(v.id) ?? { total: 0, ganho: 0, perdido: 0 };
    const decididos = stats.ganho + stats.perdido;
    return {
      vendedorId: v.id,
      vendedorNome: v.nome,
      ativo: v.ativo,
      total: stats.total,
      ganho: stats.ganho,
      perdido: stats.perdido,
      taxaConversao: decididos > 0 ? Math.round((stats.ganho / decididos) * 1000) / 10 : null,
    };
  });

  const ranking = [...porVendedor].sort((a, b) => b.total - a.total);

  const totalGanho = clientes.filter((c) => c.etapaFunil === 'GANHO').length;
  const totalPerdido = clientes.filter((c) => c.etapaFunil === 'PERDIDO').length;
  const totalDecididos = totalGanho + totalPerdido;

  return {
    totalClientes: clientes.length,
    cadastrosNoMes,
    porEtapa,
    taxaConversaoGeral: totalDecididos > 0 ? Math.round((totalGanho / totalDecididos) * 1000) / 10 : null,
    porVendedor,
    ranking,
  };
}
