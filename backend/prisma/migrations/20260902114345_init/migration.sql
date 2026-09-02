-- CreateEnum
CREATE TYPE "Perfil" AS ENUM ('VENDEDOR', 'SUPERVISOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "TipoPessoa" AS ENUM ('PJ', 'PF');

-- CreateEnum
CREATE TYPE "ServicoInteresse" AS ENUM ('PORTARIA_CONTROLE_ACESSO', 'VIGILANCIA_PATRIMONIAL', 'LIMPEZA_HIGIENIZACAO', 'MANUTENCAO_PREDIAL', 'CONSULTORIA_SEGURANCA', 'MONITORAMENTO');

-- CreateEnum
CREATE TYPE "Escala" AS ENUM ('ESCALA_12X36', 'ESCALA_44H_SEMANAIS', 'OUTRA');

-- CreateEnum
CREATE TYPE "Turno" AS ENUM ('DIURNO', 'NOTURNO', 'H24');

-- CreateEnum
CREATE TYPE "EtapaFunil" AS ENUM ('NOVO', 'CONTATO_FEITO', 'VISITA_AGENDADA', 'PROPOSTA_ENVIADA', 'NEGOCIACAO', 'GANHO', 'PERDIDO');

-- CreateEnum
CREATE TYPE "TipoInteracao" AS ENUM ('LIGACAO', 'VISITA', 'WHATSAPP', 'EMAIL');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDENTE', 'USADO', 'EXPIRADO', 'REVOGADO');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "perfil" "Perfil" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "metaMensal" DECIMAL(12,2),
    "percentualComissao" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invites" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nome" TEXT,
    "perfil" "Perfil" NOT NULL DEFAULT 'VENDEDOR',
    "tokenHash" TEXT NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDENTE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "criadoPorId" TEXT NOT NULL,
    "usuarioGeradoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "userAgent" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "tipoPessoa" "TipoPessoa" NOT NULL,
    "cnpjCpf" TEXT NOT NULL,
    "razaoSocial" TEXT,
    "nomeFantasia" TEXT,
    "inscricaoEstadual" TEXT,
    "porte" TEXT,
    "cep" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "uf" TEXT,
    "nomeContato" TEXT,
    "cargo" TEXT,
    "telefone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "servicosInteresse" "ServicoInteresse"[],
    "qtdPostos" INTEGER,
    "escala" "Escala",
    "escalaOutraDescricao" TEXT,
    "turno" "Turno",
    "concorrenteAtual" TEXT,
    "valorEstimadoMensal" DECIMAL(12,2),
    "previsaoDecisao" TIMESTAMP(3),
    "etapaFunil" "EtapaFunil" NOT NULL DEFAULT 'NOVO',
    "motivoPerda" TEXT,
    "vendedorId" TEXT NOT NULL,
    "dataCadastro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reservadoAte" TIMESTAMP(3),
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "fotoFachadaPath" TEXT,
    "observacoes" TEXT,
    "consentimentoLgpd" BOOLEAN NOT NULL DEFAULT false,
    "dataConsentimento" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interacoes" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" "TipoInteracao" NOT NULL,
    "descricao" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "proximoPasso" TEXT,
    "dataProximoPasso" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT,
    "antes" JSONB,
    "depois" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "diasReservaCarteira" INTEGER NOT NULL DEFAULT 60,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "invites_tokenHash_key" ON "invites"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "invites_usuarioGeradoId_key" ON "invites"("usuarioGeradoId");

-- CreateIndex
CREATE INDEX "invites_email_idx" ON "invites"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_usuarioId_idx" ON "refresh_tokens"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_cnpjCpf_key" ON "clientes"("cnpjCpf");

-- CreateIndex
CREATE INDEX "clientes_vendedorId_idx" ON "clientes"("vendedorId");

-- CreateIndex
CREATE INDEX "clientes_etapaFunil_idx" ON "clientes"("etapaFunil");

-- CreateIndex
CREATE INDEX "clientes_cidade_idx" ON "clientes"("cidade");

-- CreateIndex
CREATE INDEX "clientes_reservadoAte_idx" ON "clientes"("reservadoAte");

-- CreateIndex
CREATE INDEX "interacoes_clienteId_idx" ON "interacoes"("clienteId");

-- CreateIndex
CREATE INDEX "audit_logs_entidade_entidadeId_idx" ON "audit_logs"("entidade", "entidadeId");

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_usuarioGeradoId_fkey" FOREIGN KEY ("usuarioGeradoId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interacoes" ADD CONSTRAINT "interacoes_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interacoes" ADD CONSTRAINT "interacoes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
