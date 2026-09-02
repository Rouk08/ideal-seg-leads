import { PrismaClient, Perfil, TipoPessoa, ServicoInteresse, Escala, Turno, EtapaFunil } from '@prisma/client';
import argon2 from 'argon2';
import { isValidCnpj, isValidCpf } from '../src/lib/validators/cpfCnpj';

const prisma = new PrismaClient();

/**
 * Gera um CNPJ/CPF sintético que passa na validação real de dígito
 * verificador (mesma função usada em produção) — pra que os dados de seed
 * sejam utilizáveis em qualquer teste manual que passe pelo validador, sem
 * cair num "CNPJ inválido" só por ser fake. Nunca gera um número que
 * corresponda a uma empresa/pessoa real (os 8-12 dígitos base são
 * sequenciais e óbvios, ex.: 11222333).
 */
function gerarDocumentoValido(baseDigits: string, tipo: 'PF' | 'PJ'): string {
  const tamanhoBase = tipo === 'PF' ? 9 : 12;
  const base = baseDigits.padEnd(tamanhoBase, '0').slice(0, tamanhoBase);

  for (let dv1 = 0; dv1 <= 9; dv1++) {
    for (let dv2 = 0; dv2 <= 9; dv2++) {
      const candidato = `${base}${dv1}${dv2}`;
      if (tipo === 'PF' ? isValidCpf(candidato) : isValidCnpj(candidato)) {
        return candidato;
      }
    }
  }
  throw new Error(`não foi possível gerar documento válido a partir de ${baseDigits}`);
}

async function upsertUsuario(params: {
  nome: string;
  email: string;
  senha: string;
  perfil: Perfil;
  metaMensal?: number;
  percentualComissao?: number;
}) {
  return prisma.usuario.upsert({
    where: { email: params.email },
    update: {},
    create: {
      nome: params.nome,
      email: params.email,
      senhaHash: await argon2.hash(params.senha, { type: argon2.argon2id }),
      perfil: params.perfil,
      metaMensal: params.metaMensal,
      percentualComissao: params.percentualComissao,
    },
  });
}

async function main() {
  const senhaPadrao = process.env.SEED_ADMIN_SENHA ?? 'TrocarSenha123!';

  const admin = await upsertUsuario({
    nome: 'Administrador',
    email: 'admin@idealseg.com.br',
    senha: senhaPadrao,
    perfil: Perfil.ADMIN,
  });

  const supervisor = await upsertUsuario({
    nome: 'Carla Supervisora',
    email: 'supervisor@idealseg.com.br',
    senha: senhaPadrao,
    perfil: Perfil.SUPERVISOR,
  });

  const vendedor = await upsertUsuario({
    nome: 'João Vendedor',
    email: 'vendedor@idealseg.com.br',
    senha: senhaPadrao,
    perfil: Perfil.VENDEDOR,
    metaMensal: 15000,
    percentualComissao: 3.5,
  });

  await prisma.settings.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default', diasReservaCarteira: 60 },
  });

  const clientesFicticios = [
    {
      base: '11222333',
      tipoPessoa: TipoPessoa.PJ,
      razaoSocial: 'Condomínio Residencial Jardim das Flores',
      nomeFantasia: 'Jardim das Flores',
      cidade: 'Gaspar',
      uf: 'SC',
      cep: '89110000',
      bairro: 'Centro',
      logradouro: 'Rua XV de Novembro',
      numero: '450',
      servicosInteresse: [ServicoInteresse.PORTARIA_CONTROLE_ACESSO, ServicoInteresse.VIGILANCIA_PATRIMONIAL],
      etapaFunil: EtapaFunil.NOVO,
      escala: Escala.ESCALA_12X36,
      turno: Turno.H24,
      qtdPostos: 2,
      valorEstimadoMensal: 9800,
    },
    {
      base: '22333444',
      tipoPessoa: TipoPessoa.PJ,
      razaoSocial: 'Supermercado Bom Preço Gaspar Ltda',
      nomeFantasia: 'Bom Preço Gaspar',
      cidade: 'Gaspar',
      uf: 'SC',
      cep: '89110100',
      bairro: 'Prainha',
      logradouro: 'Av. Getúlio Vargas',
      numero: '1200',
      servicosInteresse: [ServicoInteresse.VIGILANCIA_PATRIMONIAL, ServicoInteresse.MONITORAMENTO],
      etapaFunil: EtapaFunil.CONTATO_FEITO,
      escala: Escala.ESCALA_44H_SEMANAIS,
      turno: Turno.NOTURNO,
      qtdPostos: 1,
      valorEstimadoMensal: 6200,
    },
    {
      base: '33444555',
      tipoPessoa: TipoPessoa.PJ,
      razaoSocial: 'Indústria Têxtil Vale do Itajaí S.A.',
      nomeFantasia: 'Têxtil Vale',
      cidade: 'Gaspar',
      uf: 'SC',
      cep: '89111000',
      bairro: 'Belchior Alto',
      logradouro: 'Rua Ërico Blosfeld',
      numero: '780',
      servicosInteresse: [ServicoInteresse.PORTARIA_CONTROLE_ACESSO, ServicoInteresse.LIMPEZA_HIGIENIZACAO],
      etapaFunil: EtapaFunil.VISITA_AGENDADA,
      escala: Escala.ESCALA_12X36,
      turno: Turno.H24,
      qtdPostos: 3,
      valorEstimadoMensal: 18500,
    },
    {
      base: '44555666',
      tipoPessoa: TipoPessoa.PJ,
      razaoSocial: 'Clínica Odontológica Sorriso Gaspar Ltda',
      nomeFantasia: 'Clínica Sorriso',
      cidade: 'Gaspar',
      uf: 'SC',
      cep: '89110200',
      bairro: 'Centro',
      logradouro: 'Rua Domingos Braun',
      numero: '95',
      servicosInteresse: [ServicoInteresse.LIMPEZA_HIGIENIZACAO],
      etapaFunil: EtapaFunil.PROPOSTA_ENVIADA,
      escala: Escala.OUTRA,
      escalaOutraDescricao: '3x por semana, 4h/dia',
      turno: Turno.DIURNO,
      qtdPostos: 1,
      valorEstimadoMensal: 1800,
    },
    {
      base: '55666777',
      tipoPessoa: TipoPessoa.PJ,
      razaoSocial: 'Galpão Logístico Norte Catarinense Ltda',
      nomeFantasia: 'Log Norte',
      cidade: 'Gaspar',
      uf: 'SC',
      cep: '89112000',
      bairro: 'Poço Grande',
      logradouro: 'Rod. Antônio Heil',
      numero: '3400',
      servicosInteresse: [ServicoInteresse.VIGILANCIA_PATRIMONIAL, ServicoInteresse.CONSULTORIA_SEGURANCA],
      etapaFunil: EtapaFunil.NEGOCIACAO,
      escala: Escala.ESCALA_12X36,
      turno: Turno.H24,
      qtdPostos: 4,
      concorrenteAtual: 'Vigilância Sul Ltda',
      valorEstimadoMensal: 24000,
    },
    {
      base: '66777888',
      tipoPessoa: TipoPessoa.PJ,
      razaoSocial: 'Shopping Blumenau Center S.A.',
      nomeFantasia: 'Blumenau Center',
      cidade: 'Blumenau',
      uf: 'SC',
      cep: '89010000',
      bairro: 'Centro',
      logradouro: 'Rua Sete de Setembro',
      numero: '2100',
      servicosInteresse: [ServicoInteresse.PORTARIA_CONTROLE_ACESSO, ServicoInteresse.MONITORAMENTO, ServicoInteresse.VIGILANCIA_PATRIMONIAL],
      etapaFunil: EtapaFunil.GANHO,
      escala: Escala.ESCALA_12X36,
      turno: Turno.H24,
      qtdPostos: 6,
      valorEstimadoMensal: 42000,
    },
    {
      base: '77888999',
      tipoPessoa: TipoPessoa.PJ,
      razaoSocial: 'Escola Técnica Blumenau Ltda',
      nomeFantasia: 'ETB',
      cidade: 'Blumenau',
      uf: 'SC',
      cep: '89020000',
      bairro: 'Velha',
      logradouro: 'Rua Amazonas',
      numero: '640',
      servicosInteresse: [ServicoInteresse.PORTARIA_CONTROLE_ACESSO, ServicoInteresse.LIMPEZA_HIGIENIZACAO, ServicoInteresse.MANUTENCAO_PREDIAL],
      etapaFunil: EtapaFunil.PERDIDO,
      motivoPerda: 'Fechou com concorrente por preço',
      escala: Escala.ESCALA_44H_SEMANAIS,
      turno: Turno.DIURNO,
      qtdPostos: 2,
      concorrenteAtual: 'Proteção Total Segurança',
      valorEstimadoMensal: 5400,
    },
    {
      base: '88999000',
      tipoPessoa: TipoPessoa.PJ,
      razaoSocial: 'Hospital Regional Blumenau Ltda',
      nomeFantasia: 'Hospital Regional',
      cidade: 'Blumenau',
      uf: 'SC',
      cep: '89030000',
      bairro: 'Garcia',
      logradouro: 'Rua Iguaçu',
      numero: '900',
      servicosInteresse: [ServicoInteresse.VIGILANCIA_PATRIMONIAL, ServicoInteresse.LIMPEZA_HIGIENIZACAO, ServicoInteresse.MANUTENCAO_PREDIAL],
      etapaFunil: EtapaFunil.CONTATO_FEITO,
      escala: Escala.ESCALA_12X36,
      turno: Turno.H24,
      qtdPostos: 5,
      valorEstimadoMensal: 31000,
    },
    {
      base: '99000111',
      tipoPessoa: TipoPessoa.PJ,
      razaoSocial: 'Condomínio Comercial Blumenau Business Ltda',
      nomeFantasia: 'Blumenau Business',
      cidade: 'Blumenau',
      uf: 'SC',
      cep: '89040000',
      bairro: 'Água Verde',
      logradouro: 'Rua Paraguai',
      numero: '150',
      servicosInteresse: [ServicoInteresse.PORTARIA_CONTROLE_ACESSO, ServicoInteresse.MONITORAMENTO],
      etapaFunil: EtapaFunil.NOVO,
      escala: Escala.ESCALA_12X36,
      turno: Turno.H24,
      qtdPostos: 2,
      valorEstimadoMensal: 8700,
    },
    {
      base: '123456',
      tipoPessoa: TipoPessoa.PF,
      razaoSocial: 'Maria Aparecida Souza',
      nomeFantasia: '',
      cidade: 'Blumenau',
      uf: 'SC',
      cep: '89050000',
      bairro: 'Itoupava Seca',
      logradouro: 'Rua Uruguai',
      numero: '77',
      servicosInteresse: [ServicoInteresse.CONSULTORIA_SEGURANCA],
      etapaFunil: EtapaFunil.NOVO,
      turno: Turno.DIURNO,
      valorEstimadoMensal: 1200,
    },
  ];

  for (const c of clientesFicticios) {
    const cnpjCpf = gerarDocumentoValido(c.base, c.tipoPessoa);
    await prisma.cliente.upsert({
      where: { cnpjCpf },
      update: {},
      create: {
        tipoPessoa: c.tipoPessoa,
        cnpjCpf,
        razaoSocial: c.razaoSocial,
        nomeFantasia: c.nomeFantasia,
        cidade: c.cidade,
        uf: c.uf,
        cep: c.cep,
        bairro: c.bairro,
        logradouro: c.logradouro,
        numero: c.numero,
        servicosInteresse: c.servicosInteresse,
        etapaFunil: c.etapaFunil,
        motivoPerda: c.motivoPerda,
        escala: c.escala,
        escalaOutraDescricao: c.escalaOutraDescricao,
        turno: c.turno,
        qtdPostos: c.qtdPostos,
        concorrenteAtual: c.concorrenteAtual,
        valorEstimadoMensal: c.valorEstimadoMensal,
        nomeContato: 'Responsável ' + c.nomeFantasia,
        telefone: '4733' + String(Math.floor(100000 + Math.random() * 900000)),
        email: `contato@${(c.nomeFantasia || c.razaoSocial).toLowerCase().replace(/[^a-z0-9]+/g, '')}.com.br`,
        consentimentoLgpd: true,
        dataConsentimento: new Date(),
        vendedorId: vendedor.id,
        reservadoAte: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      },
    });
  }

  console.log('Seed concluído.');
  console.log(`Admin:      ${admin.email} / senha: ${senhaPadrao}`);
  console.log(`Supervisor: ${supervisor.email} / senha: ${senhaPadrao}`);
  console.log(`Vendedor:   ${vendedor.email} / senha: ${senhaPadrao}`);
  console.log(`${clientesFicticios.length} clientes fictícios criados (Gaspar/Blumenau).`);
  console.log('=> troque as senhas assim que fizer o primeiro login.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
