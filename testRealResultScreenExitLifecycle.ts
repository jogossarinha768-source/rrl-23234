import { WheelVisionAnalyzer } from './src/services/WheelVisionAnalyzer';

async function runRealResultScreenExitLifecycleTest() {
  console.log('=== TEST: REAL RESULT SCREEN EXIT LIFECYCLE ===\n');

  const analyzer = new WheelVisionAnalyzer(3, 85);
  let eventIdsCreated: string[] = [];

  // -------------------------------------------------------------
  // ROUND 1: R001 - princesa
  // -------------------------------------------------------------
  console.log('--- SUB-TEST 1: Round 1 (princesa @ 95%) ---');
  let res1 = analyzer.processarDeteccao('princesa', 95, true, 0.90, 'session_test_1', 1);
  console.log(`Frame 1: state=${res1.state}, confirmed=${res1.confirmedNow}, roundLock=${(analyzer as any).roundLock}`);

  let res2 = analyzer.processarDeteccao('princesa', 96, true, 0.92, 'session_test_1', 2);
  console.log(`Frame 2: state=${res2.state}, confirmed=${res2.confirmedNow}, roundLock=${(analyzer as any).roundLock}`);

  let res3 = analyzer.processarDeteccao('princesa', 95, true, 0.91, 'session_test_1', 3);
  console.log(`Frame 3: state=${res3.state}, confirmed=${res3.confirmedNow}, roundLock=${(analyzer as any).roundLock}`);

  if (!res3.confirmedNow) {
    throw new Error('FAILED: Round 1 should be confirmed on frame 3!');
  }
  if (!res3.eventId) {
    throw new Error('FAILED: Round 1 should have generated an EventID!');
  }
  eventIdsCreated.push(res3.eventId);
  console.log(`✓ Round 1 Confirmed with EventID: ${res3.eventId}`);

  // -------------------------------------------------------------
  // DUPLICATES WHILE RESULT SCREEN REMAINS PRESENT
  // -------------------------------------------------------------
  console.log('\n--- SUB-TEST 2: Duplicate Frames (resultScreen = true) ---');
  for (let f = 4; f <= 20; f++) {
    let dupRes = analyzer.processarDeteccao('princesa', 95, true, 0.90, 'session_test_1', f);
    if (dupRes.confirmedNow) {
      throw new Error(`FAILED: Frame ${f} was wrongly confirmed during duplicate window!`);
    }
  }
  console.log(`✓ 17 duplicate frames correctly blocked during WAITING_FOR_RESULT_SCREEN_EXIT.`);

  // -------------------------------------------------------------
  // EXIT RESULT SCREEN (3 CONSECUTIVE FRAMES false)
  // -------------------------------------------------------------
  console.log('\n--- SUB-TEST 3: Result Screen Exit Sequence (3x false) ---');
  let exit1 = analyzer.processarDeteccao(null, 0, false, 0, 'session_test_1', 21);
  console.log(`Exit Frame 1: state=${exit1.state}, exitCounter=${(analyzer as any).resultScreenGoneFramesCount}, roundLock=${(analyzer as any).roundLock}`);

  let exit2 = analyzer.processarDeteccao(null, 0, false, 0, 'session_test_1', 22);
  console.log(`Exit Frame 2: state=${exit2.state}, exitCounter=${(analyzer as any).resultScreenGoneFramesCount}, roundLock=${(analyzer as any).roundLock}`);

  let exit3 = analyzer.processarDeteccao(null, 0, false, 0, 'session_test_1', 23);
  console.log(`Exit Frame 3: state=${exit3.state}, exitCounter=${(analyzer as any).resultScreenGoneFramesCount}, roundLock=${(analyzer as any).roundLock}`);

  if (exit3.state !== 'WAITING_FOR_RESULT') {
    throw new Error(`FAILED: After 3 false frames, state should be WAITING_FOR_RESULT, got ${exit3.state}`);
  }
  if ((analyzer as any).roundLock) {
    throw new Error('FAILED: roundLock should be false after result screen exit!');
  }
  console.log('✓ Exit confirmed on frame 3. roundLock released (false), state = WAITING_FOR_RESULT.');

  // -------------------------------------------------------------
  // ROUND 2: R002 - boia
  // -------------------------------------------------------------
  console.log('\n--- SUB-TEST 4: Round 2 (boia @ 90%) ---');
  let r2_1 = analyzer.processarDeteccao('boia', 90, true, 0.88, 'session_test_1', 24);
  let r2_2 = analyzer.processarDeteccao('boia', 91, true, 0.89, 'session_test_1', 25);
  let r2_3 = analyzer.processarDeteccao('boia', 90, true, 0.88, 'session_test_1', 26);

  if (!r2_3.confirmedNow) {
    throw new Error('FAILED: Round 2 should be confirmed on frame 26!');
  }
  if (!r2_3.eventId) {
    throw new Error('FAILED: Round 2 should have generated an EventID!');
  }
  if (eventIdsCreated.includes(r2_3.eventId)) {
    throw new Error(`FAILED: EventID for Round 2 (${r2_3.eventId}) is not unique!`);
  }
  eventIdsCreated.push(r2_3.eventId);
  console.log(`✓ Round 2 Confirmed with EventID: ${r2_3.eventId}`);

  // Exit Round 2
  analyzer.processarDeteccao(null, 0, false, 0, 'session_test_1', 27);
  analyzer.processarDeteccao(null, 0, false, 0, 'session_test_1', 28);
  let r2_exit3 = analyzer.processarDeteccao(null, 0, false, 0, 'session_test_1', 29);
  console.log(`✓ Round 2 Exit confirmed. state = ${r2_exit3.state}, roundLock = ${(analyzer as any).roundLock}`);

  // -------------------------------------------------------------
  // ROUND 3: R003 - princesa
  // -------------------------------------------------------------
  console.log('\n--- SUB-TEST 5: Round 3 (princesa @ 95%) ---');
  let r3_1 = analyzer.processarDeteccao('princesa', 95, true, 0.90, 'session_test_1', 30);
  let r3_2 = analyzer.processarDeteccao('princesa', 96, true, 0.92, 'session_test_1', 31);
  let r3_3 = analyzer.processarDeteccao('princesa', 95, true, 0.91, 'session_test_1', 32);

  if (!r3_3.confirmedNow) {
    throw new Error('FAILED: Round 3 should be confirmed on frame 32!');
  }
  if (!r3_3.eventId) {
    throw new Error('FAILED: Round 3 should have generated an EventID!');
  }
  if (eventIdsCreated.includes(r3_3.eventId)) {
    throw new Error(`FAILED: EventID for Round 3 (${r3_3.eventId}) is not unique!`);
  }
  eventIdsCreated.push(r3_3.eventId);
  console.log(`✓ Round 3 Confirmed with EventID: ${r3_3.eventId}`);

  // Exit Round 3
  analyzer.processarDeteccao(null, 0, false, 0, 'session_test_1', 33);
  analyzer.processarDeteccao(null, 0, false, 0, 'session_test_1', 34);
  let r3_exit3 = analyzer.processarDeteccao(null, 0, false, 0, 'session_test_1', 35);
  console.log(`✓ Round 3 Exit confirmed. state = ${r3_exit3.state}, roundLock = ${(analyzer as any).roundLock}`);

  // -------------------------------------------------------------
  // FINAL AUDIT
  // -------------------------------------------------------------
  console.log('\n=== FINAL SUMMARY AUDIT ===');
  console.log(`- Confirmed Rounds: 3 / Expected: 3`);
  console.log(`- Unique EventIDs: ${eventIdsCreated.length} (${eventIdsCreated.join(', ')})`);
  const metrics = analyzer.getMetrics();
  console.log(`- Telas Encerradas: ${metrics.telasResultadoEncerradas}`);
  console.log(`- Rodadas Liberadas: ${metrics.rodadasLiberadas}`);
  console.log(`- Duplicações Bloqueadas: ${metrics.totalDuplicacoesBloqueadas}`);

  if (eventIdsCreated.length !== 3) {
    throw new Error('FAILED: Expected 3 unique EventIDs!');
  }
  if (metrics.telasResultadoEncerradas !== 3) {
    throw new Error(`FAILED: Expected 3 telas encerradas, got ${metrics.telasResultadoEncerradas}`);
  }

  console.log('\n✅ ALL LIFECYCLE TESTS PASSED PERFECTLY!');
}

runRealResultScreenExitLifecycleTest().catch((err) => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
