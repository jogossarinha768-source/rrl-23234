import { WheelVisionAnalyzer } from '../src/services/WheelVisionAnalyzer';
import { WinnerReferenceMatcher } from '../src/services/WinnerReferenceMatcher';
import { LocalWheelRecognizer } from '../src/services/LocalWheelRecognizer';
import { clearPersistedEventIdsCache } from '../src/services/resultadoService';

async function runTests() {
  console.log('===============================================================');
  console.log('TEST SUITE: CANDIDATE PRESERVATION, CONFIRMATION & PERSISTENCE');
  console.log('===============================================================\n');

  let passedTests = 0;
  let totalTests = 10;

  // -------------------------------------------------------------
  // CENÁRIO 1: Candidato Fraco Preservado (62% score, 4% gap)
  // -------------------------------------------------------------
  console.log('--- CENÁRIO 1: Candidato Fraco Preservado (score 62%, gap 4%) ---');
  {
    const analyzer = new WheelVisionAnalyzer();
    const res = analyzer.processarDeteccao('balao', 62, true, 0.95, 'sess_1', 1, Date.now(), 4);
    const candidatePreserved = res.candidateResult?.candidato === 'balao';
    const confirmacoesZero = res.candidateResult?.confirmacoesConsecutivas === 0;
    const isCandidateState = res.state === 'RESULT_CANDIDATE';
    const notConfirmed = res.confirmedNow === false && !res.eventId;

    if (candidatePreserved && confirmacoesZero && isCandidateState && notConfirmed) {
      console.log('✅ CENÁRIO 1 PASSOU: Candidato balao preservado (62%), confirmacoes 0/3, estado RESULT_CANDIDATE, sem eventId.');
      passedTests++;
    } else {
      console.error('❌ CENÁRIO 1 FALHOU:', { candidatePreserved, confirmacoesZero, isCandidateState, notConfirmed, res });
    }
  }

  // -------------------------------------------------------------
  // CENÁRIO 2: Elegível para Confirmação (78% score, 4% gap)
  // -------------------------------------------------------------
  console.log('\n--- CENÁRIO 2: Elegível para Confirmação (score 78%, gap 4%) ---');
  {
    const analyzer = new WheelVisionAnalyzer();
    const res = analyzer.processarDeteccao('balao', 78, true, 0.95, 'sess_1', 1, Date.now(), 4);
    const candidatePreserved = res.candidateResult?.candidato === 'balao';
    const confirmacoesUm = res.candidateResult?.confirmacoesConsecutivas === 1;
    const isConfirmingState = res.state === 'RESULT_CONFIRMING';
    const notConfirmed = res.confirmedNow === false && !res.eventId;

    if (candidatePreserved && confirmacoesUm && isConfirmingState && notConfirmed) {
      console.log('✅ CENÁRIO 2 PASSOU: Candidato balao elegível (78%), confirmacoes 1/3, estado RESULT_CONFIRMING.');
      passedTests++;
    } else {
      console.error('❌ CENÁRIO 2 FALHOU:', { candidatePreserved, confirmacoesUm, isConfirmingState, notConfirmed, res });
    }
  }

  // -------------------------------------------------------------
  // CENÁRIO 3: Três Frames Consecutivos Elegíveis (78%, 81%, 83%)
  // -------------------------------------------------------------
  console.log('\n--- CENÁRIO 3: Três Frames Consecutivos Elegíveis (78% -> 81% -> 83%) ---');
  {
    clearPersistedEventIdsCache();
    const analyzer = new WheelVisionAnalyzer();
    const t0 = Date.now();
    const r1 = analyzer.processarDeteccao('balao', 78, true, 0.95, 'sess_1', 1, t0, 4);
    const r2 = analyzer.processarDeteccao('balao', 81, true, 0.95, 'sess_1', 2, t0 + 100, 5);
    const r3 = analyzer.processarDeteccao('balao', 83, true, 0.95, 'sess_1', 3, t0 + 200, 6);

    const f1Ok = r1.candidateResult?.confirmacoesConsecutivas === 1 && !r1.eventId;
    const f2Ok = r2.candidateResult?.confirmacoesConsecutivas === 2 && !r2.eventId;
    const f3Ok = r3.confirmedNow === true && r3.status === 'confirmado' && r3.objeto === 'balao' && !!r3.eventId;

    if (f1Ok && f2Ok && f3Ok) {
      console.log('✅ CENÁRIO 3 PASSOU: 1/3 -> 2/3 -> 3/3 confirmado com eventId = ' + r3.eventId);
      passedTests++;
    } else {
      console.error('❌ CENÁRIO 3 FALHOU:', { f1Ok, f2Ok, f3Ok, r1: r1.candidateResult, r2: r2.candidateResult, r3 });
    }
  }

  // -------------------------------------------------------------
  // CENÁRIO 4: Troca de Objeto (soco 80% 1/3, soco 82% 2/3 -> camera 81%)
  // -------------------------------------------------------------
  console.log('\n--- CENÁRIO 4: Troca de Objeto (soco -> camera) ---');
  {
    const analyzer = new WheelVisionAnalyzer();
    const t0 = Date.now();
    const r1 = analyzer.processarDeteccao('soco', 80, true, 0.95, 'sess_1', 1, t0, 5);
    const r2 = analyzer.processarDeteccao('soco', 82, true, 0.95, 'sess_1', 2, t0 + 100, 6);
    const r3 = analyzer.processarDeteccao('camera', 81, true, 0.95, 'sess_1', 3, t0 + 200, 5);

    const socoCount2 = r2.candidateResult?.candidato === 'soco' && r2.candidateResult.confirmacoesConsecutivas === 2;
    const cameraReset = r3.candidateResult?.candidato === 'camera' && r3.candidateResult.confirmacoesConsecutivas === 1;

    if (socoCount2 && cameraReset) {
      console.log('✅ CENÁRIO 4 PASSOU: Troca de soco (2/3) para camera reiniciou a contagem para 1/3 para camera.');
      passedTests++;
    } else {
      console.error('❌ CENÁRIO 4 FALHOU:', { socoCount2, cameraReset, r2: r2.candidateResult, r3: r3.candidateResult });
    }
  }

  // -------------------------------------------------------------
  // CENÁRIO 5: Queda Temporária de Confiança (82% 1/3 -> 80% 2/3 -> 65% preserva 2/3 -> 79% confirma 3/3)
  // -------------------------------------------------------------
  console.log('\n--- CENÁRIO 5: Queda Temporária de Confiança (82% -> 80% -> 65% -> 79%) ---');
  {
    const analyzer = new WheelVisionAnalyzer();
    const t0 = Date.now();
    const r1 = analyzer.processarDeteccao('balao', 82, true, 0.95, 'sess_1', 1, t0, 5);
    const r2 = analyzer.processarDeteccao('balao', 80, true, 0.95, 'sess_1', 2, t0 + 100, 5);
    const r3 = analyzer.processarDeteccao('balao', 65, true, 0.95, 'sess_1', 3, t0 + 200, 4);
    const r4 = analyzer.processarDeteccao('balao', 79, true, 0.95, 'sess_1', 4, t0 + 300, 5);

    const r1Ok = r1.candidateResult?.confirmacoesConsecutivas === 1;
    const r2Ok = r2.candidateResult?.confirmacoesConsecutivas === 2;
    const r3Ok = r3.candidateResult?.candidato === 'balao' && r3.candidateResult?.confirmacoesConsecutivas === 2; // preservado sem resetar
    const r4Ok = r4.confirmedNow === true && r4.status === 'confirmado' && r4.objeto === 'balao';

    if (r1Ok && r2Ok && r3Ok && r4Ok) {
      console.log('✅ CENÁRIO 5 PASSOU: Queda temporária para 65% preservou balao em 2/3 e 79% confirmou no 3/3.');
      passedTests++;
    } else {
      console.error('❌ CENÁRIO 5 FALHOU:', { r1Ok, r2Ok, r3Ok, r4Ok, r3: r3.candidateResult, r4 });
    }
  }

  // -------------------------------------------------------------
  // CENÁRIO 6: Gap Insuficiente (camera 67%, tedy 66%, gap 1%)
  // -------------------------------------------------------------
  console.log('\n--- CENÁRIO 6: Gap Insuficiente (score 67%, gap 1%) ---');
  {
    const analyzer = new WheelVisionAnalyzer();
    const res = analyzer.processarDeteccao('camera', 67, true, 0.95, 'sess_1', 1, Date.now(), 1);
    const candidatePreserved = res.candidateResult?.candidato === 'camera';
    const confirmacoesZero = res.candidateResult?.confirmacoesConsecutivas === 0;
    const notConfirmed = res.confirmedNow === false && !res.eventId;

    if (candidatePreserved && confirmacoesZero && notConfirmed) {
      console.log('✅ CENÁRIO 6 PASSOU: Gap insuficiente (1%) manteve candidate camera mas não incrementou confirmações (0/3).');
      passedTests++;
    } else {
      console.error('❌ CENÁRIO 6 FALHOU:', { candidatePreserved, confirmacoesZero, notConfirmed, res });
    }
  }

  // -------------------------------------------------------------
  // CENÁRIO 7: Score Abaixo de 55% (score 48%)
  // -------------------------------------------------------------
  console.log('\n--- CENÁRIO 7: Score Abaixo de 55% (score 48%) ---');
  {
    const analyzer = new WheelVisionAnalyzer();
    const res = analyzer.processarDeteccao('balao', 48, true, 0.95, 'sess_1', 1, Date.now(), 5);
    const noCandidate = res.candidateResult?.candidato === null;
    const confirmacoesZero = res.candidateResult?.confirmacoesConsecutivas === 0;
    const notConfirmed = res.confirmedNow === false && !res.eventId;

    if (noCandidate && confirmacoesZero && notConfirmed) {
      console.log('✅ CENÁRIO 7 PASSOU: Score 48% (< 55%) descartado sem criar candidato (NO_CANDIDATE).');
      passedTests++;
    } else {
      console.error('❌ CENÁRIO 7 FALHOU:', { noCandidate, confirmacoesZero, notConfirmed, res });
    }
  }

  // -------------------------------------------------------------
  // CENÁRIO 8: Geração de EventID (Apenas após confirmação)
  // -------------------------------------------------------------
  console.log('\n--- CENÁRIO 8: Geração de EventID Apenas no 3/3 ---');
  {
    const analyzer = new WheelVisionAnalyzer();
    const t0 = Date.now();
    const r1 = analyzer.processarDeteccao('sorvete', 85, true, 0.95, 'sess_1', 1, t0, 8);
    const r2 = analyzer.processarDeteccao('sorvete', 86, true, 0.95, 'sess_1', 2, t0 + 100, 9);
    const r3 = analyzer.processarDeteccao('sorvete', 88, true, 0.95, 'sess_1', 3, t0 + 200, 10);

    const f1NoEvt = r1.eventId === undefined;
    const f2NoEvt = r2.eventId === undefined;
    const f3HasEvt = typeof r3.eventId === 'string' && r3.eventId.startsWith('LIVE_EVT_');

    if (f1NoEvt && f2NoEvt && f3HasEvt) {
      console.log(`✅ CENÁRIO 8 PASSOU: EventID criado estritamente no 3/3 (${r3.eventId}).`);
      passedTests++;
    } else {
      console.error('❌ CENÁRIO 8 FALHOU:', { f1NoEvt, f2NoEvt, f3HasEvt, r1Evt: r1.eventId, r2Evt: r2.eventId, r3Evt: r3.eventId });
    }
  }

  // -------------------------------------------------------------
  // CENÁRIO 9: Persistência Apenas no 3/3
  // -------------------------------------------------------------
  console.log('\n--- CENÁRIO 9: Persistência Apenas no 3/3 ---');
  {
    clearPersistedEventIdsCache();
    const analyzer = new WheelVisionAnalyzer();
    const t0 = Date.now();
    const r1 = analyzer.processarDeteccao('boia', 80, true, 0.95, 'sess_1', 1, t0, 5);
    const r2 = analyzer.processarDeteccao('boia', 82, true, 0.95, 'sess_1', 2, t0 + 100, 6);
    const r3 = analyzer.processarDeteccao('boia', 84, true, 0.95, 'sess_1', 3, t0 + 200, 7);

    // Tentativas de persistência apenas quando confirmedNow === true
    let persistCount = 0;
    if (r1.confirmedNow && r1.objetoPadraoParaBanco) persistCount++;
    if (r2.confirmedNow && r2.objetoPadraoParaBanco) persistCount++;
    if (r3.confirmedNow && r3.objetoPadraoParaBanco) persistCount++;

    if (persistCount === 1 && r3.confirmedNow && r3.objetoPadraoParaBanco?.resultado === 'boia') {
      console.log('✅ CENÁRIO 9 PASSOU: Exatamente 1 tentativa de persistência no frame confirmado.');
      passedTests++;
    } else {
      console.error('❌ CENÁRIO 9 FALHOU: persistCount =', persistCount);
    }
  }

  // -------------------------------------------------------------
  // CENÁRIO 10: Múltiplas Rodadas Sequenciais
  // -------------------------------------------------------------
  console.log('\n--- CENÁRIO 10: Múltiplas Rodadas Sequenciais com Saída de Tela ---');
  {
    clearPersistedEventIdsCache();
    const analyzer = new WheelVisionAnalyzer();
    let t = Date.now();

    // Rodada 1: balao (78%, 81%, 83%)
    analyzer.processarDeteccao('balao', 78, true, 0.95, 'sess_1', 1, t, 4);
    analyzer.processarDeteccao('balao', 81, true, 0.95, 'sess_1', 2, t + 100, 5);
    const round1 = analyzer.processarDeteccao('balao', 83, true, 0.95, 'sess_1', 3, t + 200, 6);

    // Saída de tela: 3 frames false
    t += 500;
    analyzer.processarDeteccao(null, 0, false, 0, 'sess_1', 4, t, 0);
    analyzer.processarDeteccao(null, 0, false, 0, 'sess_1', 5, t + 100, 0);
    analyzer.processarDeteccao(null, 0, false, 0, 'sess_1', 6, t + 200, 0);

    // Rodada 2: sorvete (80%, 82%, 85%)
    t += 500;
    analyzer.processarDeteccao('sorvete', 80, true, 0.95, 'sess_1', 7, t, 5);
    analyzer.processarDeteccao('sorvete', 82, true, 0.95, 'sess_1', 8, t + 100, 6);
    const round2 = analyzer.processarDeteccao('sorvete', 85, true, 0.95, 'sess_1', 9, t + 200, 7);

    const r1Confirmed = round1.confirmedNow === true && round1.objeto === 'balao';
    const r2Confirmed = round2.confirmedNow === true && round2.objeto === 'sorvete';
    const distinctEventIds = round1.eventId !== round2.eventId;

    if (r1Confirmed && r2Confirmed && distinctEventIds) {
      console.log(`✅ CENÁRIO 10 PASSOU: Rodada 1 (${round1.objeto}, ${round1.eventId}) e Rodada 2 (${round2.objeto}, ${round2.eventId}) confirmadas sequencialmente!`);
      passedTests++;
    } else {
      console.error('❌ CENÁRIO 10 FALHOU:', { r1Confirmed, r2Confirmed, distinctEventIds, r1: round1, r2: round2 });
    }
  }

  console.log('\n===============================================================');
  console.log(`RESULTADO FINAL: ${passedTests}/${totalTests} PASSARAM`);
  console.log('===============================================================');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Erro na execução dos testes:', err);
  process.exit(1);
});
