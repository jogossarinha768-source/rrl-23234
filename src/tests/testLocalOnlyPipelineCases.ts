import { WheelVisionAnalyzer } from '../services/WheelVisionAnalyzer';
import { LocalWheelRecognizer } from '../services/LocalWheelRecognizer';
import { setAutoPersistEnabled, limparMemoriaResultadoService } from '../services/resultadoService';

async function runLocalOnlyPipelineCasesTest() {
  setAutoPersistEnabled(false);
  limparMemoriaResultadoService();

  console.log('========================================================================');
  console.log('      SUÍTE DE TESTES ESPECÍFICOS PIPELINE LOCAL_ONLY (TEST A - TEST H)');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details: string) {
    if (condition) {
      console.log(`[PASS] ${testName}: ${details}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}: ${details}`);
      failed++;
    }
  }

  // TEST A: Local recognizer válido com Gemini desabilitado
  console.log('--- TEST A: Local recognizer válido com Gemini desabilitado ---');
  {
    const config = LocalWheelRecognizer.getConfig();
    const analyzer = new WheelVisionAnalyzer(3, 85, 2500);

    const isLocalOnly = config.LOCAL_ONLY_MODE === true;
    const isGeminiDisabled = config.GEMINI_FALLBACK_ENABLED === false;

    // Simula resposta do reconhecedor local para 'princesa' @ 91%
    const res = analyzer.processarDeteccao('princesa', 91, true, 0.95);

    assert(
      isLocalOnly && isGeminiDisabled && res.status === 'em_analise' && res.objeto === 'princesa',
      'TEST A',
      `localOnly=${isLocalOnly}, geminiDisabled=${isGeminiDisabled}, analyzerStatus=${res.status}, object=${res.objeto}`
    );
  }

  // TEST B: Decisão aceita apenas com 3 confirmações
  console.log('\n--- TEST B: Decisão aceita apenas com 3 confirmações ---');
  {
    const analyzer = new WheelVisionAnalyzer(3, 85, 2500);

    const f1 = analyzer.processarDeteccao('princesa', 91, true, 0.95);
    const candidate1 = analyzer.getCandidateState();

    const f2 = analyzer.processarDeteccao('princesa', 92, true, 0.95);
    const candidate2 = analyzer.getCandidateState();

    const f3 = analyzer.processarDeteccao('princesa', 90, true, 0.95);
    const candidate3 = analyzer.getCandidateState();

    assert(
      f1.status === 'em_analise' && candidate1.confirmacoesConsecutivas === 1 &&
      f2.status === 'em_analise' && candidate2.confirmacoesConsecutivas === 2 &&
      f3.status === 'confirmado' && f3.objeto === 'princesa',
      'TEST B',
      `F1=${candidate1.confirmacoesConsecutivas}/3, F2=${candidate2.confirmacoesConsecutivas}/3, F3=${f3.status} (${f3.objeto})`
    );
  }

  // TEST C: Zeramento do candidato ao invalidar frame
  console.log('\n--- TEST C: Zeramento do candidato ao invalidar frame ---');
  {
    const analyzer = new WheelVisionAnalyzer(3, 85, 2500);

    analyzer.processarDeteccao('princesa', 90, true, 0.95);
    analyzer.processarDeteccao('princesa', 91, true, 0.95);
    let stateBeforeInvalid = analyzer.getCandidateState();

    // Frame 3 com detecção inválida (confiança baixa)
    analyzer.processarDeteccao('princesa', 50, true, 0.95);
    let stateAfterInvalid = analyzer.getCandidateState();

    assert(
      stateBeforeInvalid.confirmacoesConsecutivas === 2 &&
      stateBeforeInvalid.candidato === 'princesa' &&
      stateAfterInvalid.candidato === null &&
      stateAfterInvalid.confirmacoesConsecutivas === 0,
      'TEST C',
      `Antes: ${stateBeforeInvalid.candidato} (${stateBeforeInvalid.confirmacoesConsecutivas}/3) -> Depois: ${stateAfterInvalid.candidato} (${stateAfterInvalid.confirmacoesConsecutivas}/3)`
    );
  }

  // TEST D: Descarte quando fora da tela de resultado
  console.log('\n--- TEST D: Descarte quando fora da tela de resultado ---');
  {
    const analyzer = new WheelVisionAnalyzer(3, 85, 2500);

    const resOut = analyzer.processarDeteccao('princesa', 95, false, 0.0);

    assert(
      resOut.status === 'descartado_fora_de_tela_resultado' && resOut.objeto === 'não identificado',
      'TEST D',
      `Status: ${resOut.status}, Objeto retornado: ${resOut.objeto}`
    );
  }

  // TEST E: EventID gerado apenas no RESULT_CONFIRMED
  console.log('\n--- TEST E: EventID gerado apenas no RESULT_CONFIRMED ---');
  {
    const analyzer = new WheelVisionAnalyzer(3, 85, 2500);

    const f1 = analyzer.processarDeteccao('princesa', 90, true, 0.95);
    const eventId1 = analyzer.getCurrentEventId();

    const f2 = analyzer.processarDeteccao('princesa', 91, true, 0.95);
    const eventId2 = analyzer.getCurrentEventId();

    const f3 = analyzer.processarDeteccao('princesa', 92, true, 0.95);
    const eventId3 = analyzer.getCurrentEventId();

    assert(
      eventId1 === null && eventId2 === null && eventId3 !== null && eventId3.startsWith('LIVE_EVT_'),
      'TEST E',
      `Frame 1 eventId=${eventId1}, Frame 2 eventId=${eventId2}, Frame 3 eventId=${eventId3}`
    );
  }

  // TEST F: Trava de rodada impede duplicatas
  console.log('\n--- TEST F: Trava de rodada impede duplicatas ---');
  {
    const analyzer = new WheelVisionAnalyzer(3, 85, 2500);

    for (let i = 0; i < 3; i++) analyzer.processarDeteccao('princesa', 90, true, 0.95);

    const f4 = analyzer.processarDeteccao('princesa', 92, true, 0.95);
    const f5 = analyzer.processarDeteccao('princesa', 95, true, 0.95);

    assert(
      f4.status === 'duplicado' && f5.status === 'duplicado' && analyzer.isRoundLocked() === true,
      'TEST F',
      `F4 status=${f4.status}, F5 status=${f5.status}, roundLocked=${analyzer.isRoundLocked()}`
    );
  }

  // TEST G: Saída da tela de resultado libera nova rodada
  console.log('\n--- TEST G: Saída da tela de resultado libera nova rodada ---');
  {
    const analyzer = new WheelVisionAnalyzer(3, 85, 2500);

    for (let i = 0; i < 3; i++) analyzer.processarDeteccao('princesa', 90, true, 0.95);
    const lockedBefore = analyzer.isRoundLocked();

    // 3 frames sem tela de resultado
    analyzer.processarDeteccao(null, 0, false, 0);
    analyzer.processarDeteccao(null, 0, false, 0);
    analyzer.processarDeteccao(null, 0, false, 0);

    const lockedAfter = analyzer.isRoundLocked();
    const currentState = analyzer.getCurrentState();

    assert(
      lockedBefore === true && lockedAfter === false && currentState === 'WAITING_FOR_RESULT',
      'TEST G',
      `Bloqueado antes=${lockedBefore}, Bloqueado depois=${lockedAfter}, Estado final=${currentState}`
    );
  }

  // TEST H: Nomes diferentes em rodadas consecutivas geram EventIDs únicos
  console.log('\n--- TEST H: Nomes diferentes em rodadas consecutivas geram EventIDs únicos ---');
  {
    const analyzer = new WheelVisionAnalyzer(3, 85, 2500);

    // Rodada 1 - Princesa
    for (let i = 0; i < 3; i++) analyzer.processarDeteccao('princesa', 90, true, 0.95);
    const eventIdR1 = analyzer.getCurrentEventId();

    // Saída da tela
    analyzer.processarDeteccao(null, 0, false, 0);
    analyzer.processarDeteccao(null, 0, false, 0);
    analyzer.processarDeteccao(null, 0, false, 0);

    // Rodada 2 - Sorvete
    for (let i = 0; i < 3; i++) analyzer.processarDeteccao('sorvete', 91, true, 0.95);
    const eventIdR2 = analyzer.getCurrentEventId();

    assert(
      eventIdR1 !== null && eventIdR2 !== null && eventIdR1 !== eventIdR2,
      'TEST H',
      `EventID R1=${eventIdR1}, EventID R2=${eventIdR2}`
    );
  }

  console.log('\n========================================================================');
  console.log(`RESULTADO DOS TESTES ESPECÍFICOS LOCAL_ONLY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runLocalOnlyPipelineCasesTest();
