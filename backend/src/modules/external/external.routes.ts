import { Router } from 'express';
import * as externalController from './external.controller';
import { requireAuth } from '../../middlewares/auth';

export const externalRouter = Router();

// Preenchimento automático (CNPJ/CEP) — qualquer usuário autenticado usa
// isso durante o cadastro. Nunca deve travar o fluxo: 404 = "não achou,
// preencha manualmente", nunca 500.
externalRouter.get('/cnpj/:cnpj', requireAuth, externalController.cnpj);
externalRouter.get('/cep/:cep', requireAuth, externalController.cep);
