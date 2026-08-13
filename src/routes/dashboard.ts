import { Router } from 'express';
import { obterDashboardCompleto, limparHistorico } from '../services/dashboardService';
import { registrarResultadoAutomaticamente } from '../services/resultadoService';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/dashboard
 * Retorna os dados centralizados do Painel de Inteligência Estatística (resumo, últimos 20, ranking, atrasos, padrões, recentes).
 */
router.get('/dashboard', async (req, res) => {
  try {
    const dadosDashboard = await obterDashboardCompleto();
    return res.json(dadosDashboard);
  } catch (error: any) {
    logger.error('Erro no endpoint GET /api/dashboard:', error?.message);
    return res.status(500).json({
      sucesso: false,
      mensagem: error?.message || 'Erro ao carregar os dados do Painel de Inteligência.',
    });
  }
});

/**
 * POST /api/resultados & POST /api/dashboard/results
 * Registra manualmente ou via visão computacional um novo resultado no Supabase.
 */
router.post(['/resultados', '/dashboard/results'], async (req, res) => {
  try {
    const { objeto, confianca = 95, eventId, sessaoId, origem = 'manual', multiplicador } = req.body || {};
    if (!objeto) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'O campo "objeto" é obrigatório.',
      });
    }

    const resAuto = await registrarResultadoAutomaticamente(
      objeto,
      Number(confianca) || 95,
      eventId,
      sessaoId,
      origem,
      multiplicador
    );

    if (!resAuto.registrado) {
      return res.status(400).json({
        sucesso: false,
        mensagem: resAuto.motivo,
        resultado: resAuto,
      });
    }

    return res.json({
      sucesso: true,
      mensagem: 'Resultado registrado com sucesso!',
      resultado: resAuto,
    });
  } catch (error: any) {
    logger.error('Erro no endpoint POST /api/resultados:', error?.message);
    return res.status(500).json({
      sucesso: false,
      mensagem: error?.message || 'Erro ao registrar resultado no servidor.',
    });
  }
});

/**
 * DELETE /api/dashboard/results
 * Apaga todo o histórico de resultados do Supabase e do sistema.
 */
router.delete('/dashboard/results', async (req, res) => {
  try {
    const resultado = await limparHistorico();
    if (!resultado.sucesso) {
      return res.status(500).json(resultado);
    }
    return res.json(resultado);
  } catch (error: any) {
    logger.error('Erro no endpoint DELETE /api/dashboard/results:', error?.message);
    return res.status(500).json({
      sucesso: false,
      mensagem: error?.message || 'Erro ao apagar histórico de resultados.',
    });
  }
});

export default router;
