import { WheelVisionAnalyzer } from '../services/WheelVisionAnalyzer';
import {
  registrarResultadoAutomaticamente,
  setAutoPersistEnabled,
  notificarSaidaTelaResultado,
  activeScreenLifecycleMap,
} from '../services/resultadoService';

async function runMultiRoundRealLifecycleTestSuite() {
  setAutoPersistEnabled(true);

  console.log('========================================================================');
  console.log('BATERIA DE TESTES - MULTI-ROUND REAL LIFECYCLE & MULTI-PERSISTENCE');
  console.log('========================================================================\n');

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition: boolean, testName: string, detail: string) {
    if (condition) {
      console.log(`[PASS] ${testName}: ${detail}`);
      passedTests++;
    } else {
      console.error(`[FAIL] ${testName}: ${detail}`);
      failedTests++;
    }
  }

  // TESTE 1: CICLO MULTI-RODADA COMPLETO (R001 -> 300 frames -> Saída -> R002 -> 300 frames -> Saída -> R003)
  console.log('--- TESTE 1: Multi-Round Complete Lifecycle (R001 -> R002 -> R003) ---');
  {
    const analyzer = new WheelVisionAnalyzer(3, 85, 2500);
    const sessionId = 'session_multi_round_test';

    // === RODADA 1: princesa ===
    console.log('--- Iniciando Rodada 1 (princesa) ---');
    for (let i = 1; i <= 3; i++) {
      analyzer.processarDeteccao('princesa', 95, true, 0.95, sessionId, i);
    }
    const r1EventId = analyzer.getCurrentEventId();
    const r1State = analyzer.getCurrentState();
    const r1Locked = analyzer.isRoundLocked();

    assert(r1EventId !== null && r1EventId.includes('R001'), 'TESTE 1 - R001 EventID criado', `EventID: ${r1EventId}`);
    assert(r1Locked === true, 'TESTE 1 - R001 roundLock true', `roundLock: ${r1Locked}`);
    assert(r1State === 'WAITING_FOR_RESULT_SCREEN_EXIT', 'TESTE 1 - R001 Estado Pós-Confirmação', `Estado: ${r1State}`);

    // Persistir R001
    const p1 = await registrarResultadoAutomaticamente(
      'princesa',
      95,
      r1EventId!,
      sessionId
    );
    assert(p1.registrado === true, 'TESTE 1 - R001 Persistência Supabase', `Status: ${p1.registrado ? 'OK id=' + (p1.insertedId ?? p1.eventId) : p1.motivo}`);

    // Simular 300 frames da mesma tela na Rodada 1 (Duplicados)
    let r1DuplicatesBlocked = 0;
    for (let i = 4; i <= 303; i++) {
      const res = analyzer.processarDeteccao('princesa', 95, true, 0.95, sessionId, i);
      if (res.status === 'duplicado') r1DuplicatesBlocked++;
    }
    assert(r1DuplicatesBlocked === 300, 'TESTE 1 - 300 Frames Bloqueados na R001', `Bloqueados: ${r1DuplicatesBlocked}/300`);

    // Saída de Tela na Rodada 1 (3 frames sem tela de resultado)
    for (let i = 304; i <= 306; i++) {
      analyzer.processarDeteccao(null, 0, false, 0, sessionId, i);
    }
    notificarSaidaTelaResultado(sessionId);

    const r1PostExitState = analyzer.getCurrentState();
    const r1PostExitLocked = analyzer.isRoundLocked();
    const r1PostExitEventId = analyzer.getCurrentEventId();

    assert(r1PostExitLocked === false, 'TESTE 1 - R001 roundLock liberado (false)', `roundLock: ${r1PostExitLocked}`);
    assert(r1PostExitState === 'WAITING_FOR_RESULT', 'TESTE 1 - R001 Estado WAITING_FOR_RESULT', `Estado: ${r1PostExitState}`);
    assert(r1PostExitEventId === null, 'TESTE 1 - R001 EventID resetado (null)', `EventID: ${r1PostExitEventId}`);

    // === RODADA 2: boia ===
    console.log('--- Iniciando Rodada 2 (boia) ---');
    for (let i = 307; i <= 309; i++) {
      analyzer.processarDeteccao('boia', 96, true, 0.95, sessionId, i);
    }
    const r2EventId = analyzer.getCurrentEventId();
    const r2State = analyzer.getCurrentState();
    const r2Locked = analyzer.isRoundLocked();

    assert(r2EventId !== null && r2EventId.includes('R002'), 'TESTE 1 - R002 EventID criado', `EventID: ${r2EventId}`);
    assert(r2EventId !== r1EventId, 'TESTE 1 - R002 EventID Único em relação a R001', `R1: ${r1EventId} vs R2: ${r2EventId}`);
    assert(r2Locked === true, 'TESTE 1 - R002 roundLock true', `roundLock: ${r2Locked}`);

    // Persistir R002
    const p2 = await registrarResultadoAutomaticamente(
      'boia',
      96,
      r2EventId!,
      sessionId
    );
    assert(p2.registrado === true, 'TESTE 1 - R002 Persistência Supabase', `Status: ${p2.registrado ? 'OK id=' + (p2.insertedId ?? p2.eventId) : p2.motivo}`);

    // 300 frames duplicados na R002
    let r2DuplicatesBlocked = 0;
    for (let i = 310; i <= 609; i++) {
      const res = analyzer.processarDeteccao('boia', 96, true, 0.95, sessionId, i);
      if (res.status === 'duplicado') r2DuplicatesBlocked++;
    }
    assert(r2DuplicatesBlocked === 300, 'TESTE 1 - 300 Frames Bloqueados na R002', `Bloqueados: ${r2DuplicatesBlocked}/300`);

    // Saída de Tela na Rodada 2
    for (let i = 610; i <= 612; i++) {
      analyzer.processarDeteccao(null, 0, false, 0, sessionId, i);
    }
    notificarSaidaTelaResultado(sessionId);

    // === RODADA 3: princesa (Mesmo símbolo da R001 em nova rodada) ===
    console.log('--- Iniciando Rodada 3 (princesa novamente) ---');
    for (let i = 613; i <= 615; i++) {
      analyzer.processarDeteccao('princesa', 97, true, 0.95, sessionId, i);
    }
    const r3EventId = analyzer.getCurrentEventId();
    const r3Locked = analyzer.isRoundLocked();

    assert(r3EventId !== null && r3EventId.includes('R003'), 'TESTE 1 - R003 EventID criado', `EventID: ${r3EventId}`);
    assert(r3EventId !== r1EventId && r3EventId !== r2EventId, 'TESTE 1 - R003 EventID Único', `R3 EventID: ${r3EventId}`);
    assert(r3Locked === true, 'TESTE 1 - R003 roundLock true', `roundLock: ${r3Locked}`);

    // Persistir R003
    const p3 = await registrarResultadoAutomaticamente(
      'princesa',
      97,
      r3EventId!,
      sessionId
    );
    assert(p3.registrado === true, 'TESTE 1 - R003 Persistência Supabase (Mesmo símbolo)', `Status: ${p3.registrado ? 'OK id=' + (p3.insertedId ?? p3.eventId) : p3.motivo}`);
  }

  // TESTE 2: RODADAS CONSECUTIVAS COM O MESMO SÍMBOLO (princesa -> princesa -> princesa)
  console.log('\n--- TESTE 2: Same Symbol Consecutive Rounds (princesa -> princesa -> princesa) ---');
  {
    const analyzer = new WheelVisionAnalyzer(3, 85, 2500);
    const sessionId = 'session_same_symbol_test';
    const eventIds: string[] = [];

    for (let r = 1; r <= 3; r++) {
      // 3 confirmações
      for (let i = 1; i <= 3; i++) {
        analyzer.processarDeteccao('princesa', 95, true, 0.95, sessionId);
      }
      const evt = analyzer.getCurrentEventId()!;
      eventIds.push(evt);

      const p = await registrarResultadoAutomaticamente(
        'princesa',
        95,
        evt,
        sessionId
      );
      assert(p.registrado === true, `TESTE 2 - Rodada ${r} Persistida (princesa)`, `EventID: ${evt}`);

      // Saída de tela (3 frames)
      for (let i = 1; i <= 3; i++) {
        analyzer.processarDeteccao(null, 0, false, 0, sessionId);
      }
      notificarSaidaTelaResultado(sessionId);
    }

    const uniqueEventIds = new Set(eventIds);
    assert(uniqueEventIds.size === 3, 'TESTE 2 - 3 EventIDs Únicos Gerados para Mesmo Símbolo', `Total Únicos: ${uniqueEventIds.size}/3`);
  }

  // TESTE 3: GARANTIA DE DEDUPLICAÇÃO DE PERSISTÊNCIA DENTRO DA MESMA RODADA
  console.log('\n--- TESTE 3: Deduplicação de Persistência na Mesma Rodada ---');
  {
    const sessionId = 'session_dedup_test';
    const eventId = `LIVE_EVT_${Date.now()}_R001`;

    const p1 = await registrarResultadoAutomaticamente(
      'sorvete',
      92,
      eventId,
      sessionId
    );
    assert(p1.registrado === true, 'TESTE 3 - Primeira Tentativa Registrada com Sucesso', `Status: ${p1.registrado ? 'OK id=' + (p1.insertedId ?? p1.eventId) : p1.motivo}`);

    const p2 = await registrarResultadoAutomaticamente(
      'sorvete',
      92,
      eventId,
      sessionId
    );
    assert(p2.registrado === false, 'TESTE 3 - Segunda Tentativa Rejeitada na Mesma Rodada', `Motivo: ${p2.motivo}`);
  }

  console.log('\n========================================================================');
  console.log(`RESULTADO FINAL DOS TESTES: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('========================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runMultiRoundRealLifecycleTestSuite().catch((err) => {
  console.error('Erro ao executar bateria de testes:', err);
  process.exit(1);
});
