import { WheelVisionAnalyzer } from '../services/WheelVisionAnalyzer';
import { WinnerReferenceMatcher } from '../services/WinnerReferenceMatcher';

async function runTests() {
  console.log('====================================================');
  console.log(' TEST SUITE: CANDIDATE PRESERVATION & STABILIZATION ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  const baseTs = Date.now();

  // ----------------------------------------------------
  // TEST 1 to 6: Progressive Stabilization
  // ----------------------------------------------------
  console.log('--- TEST 1 to 6: Progressive Stabilization ---');
  const analyzer1 = new WheelVisionAnalyzer(3, 85);

  // Frame 1: camera 67%, gap 1%
  const res1 = analyzer1.processarDeteccao('camera', 67, baseTs + 100, 1, true, 90);
  assert(res1.candidateResult.candidato === 'camera', `Frame 1 (67%, gap 1%): Candidate preserved as 'camera' (got '${res1.candidateResult.candidato}')`);
  assert(res1.candidateResult.confirmacoesConsecutivas === 0, `Frame 1: Confirmations count is 0 (got ${res1.candidateResult.confirmacoesConsecutivas})`);
  assert(res1.status === 'em_analise', `Frame 1: Status is 'em_analise'`);

  // Frame 2: camera 68%, gap 2%
  const res2 = analyzer1.processarDeteccao('camera', 68, baseTs + 200, 2, true, 91);
  assert(res2.candidateResult.candidato === 'camera', `Frame 2 (68%, gap 2%): Candidate preserved as 'camera' (got '${res2.candidateResult.candidato}')`);
  assert(res2.candidateResult.confirmacoesConsecutivas === 0, `Frame 2: Confirmations count is 0 (got ${res2.candidateResult.confirmacoesConsecutivas})`);

  // Frame 3: camera 82%, gap 4% (Score < 85%)
  const res3 = analyzer1.processarDeteccao('camera', 82, baseTs + 300, 4, true, 92);
  assert(res3.candidateResult.candidato === 'camera', `Frame 3 (82%, gap 4%): Candidate preserved as 'camera' (got '${res3.candidateResult.candidato}')`);
  assert(res3.candidateResult.confirmacoesConsecutivas === 0, `Frame 3: Confirmations count is 0 (got ${res3.candidateResult.confirmacoesConsecutivas})`);

  // Frame 4: camera 87%, gap 7% (Eligible 1/3)
  const res4 = analyzer1.processarDeteccao('camera', 87, baseTs + 400, 7, true, 93);
  assert(res4.candidateResult.candidato === 'camera', `Frame 4 (87%, gap 7%): Candidate is 'camera'`);
  assert(res4.candidateResult.confirmacoesConsecutivas === 1, `Frame 4: Confirmations incremented to 1 (got ${res4.candidateResult.confirmacoesConsecutivas})`);
  assert(res4.status === 'em_analise', `Frame 4: Status is 'em_analise' (1/3)`);

  // Frame 5: camera 88%, gap 8% (Eligible 2/3)
  const res5 = analyzer1.processarDeteccao('camera', 88, baseTs + 500, 8, true, 94);
  assert(res5.candidateResult.candidato === 'camera', `Frame 5 (88%, gap 8%): Candidate is 'camera'`);
  assert(res5.candidateResult.confirmacoesConsecutivas === 2, `Frame 5: Confirmations incremented to 2 (got ${res5.candidateResult.confirmacoesConsecutivas})`);

  // Frame 6: camera 89%, gap 9% (Eligible 3/3 -> CONFIRMED!)
  const res6 = analyzer1.processarDeteccao('camera', 89, baseTs + 600, 9, true, 95);
  assert(res6.status === 'confirmado', `Frame 6 (89%, gap 9%): Result is CONFIRMED (got '${res6.status}')`);
  assert(res6.objeto === 'camera', `Frame 6: Confirmed object is 'camera' (got '${res6.objeto}')`);

  // ----------------------------------------------------
  // TEST 7: Candidate with score 54% (Below 55% threshold)
  // ----------------------------------------------------
  console.log('\n--- TEST 7: Candidate camera 54%, gap 14% (Below 55%) ---');
  const analyzer2 = new WheelVisionAnalyzer(3, 85);
  const res7 = analyzer2.processarDeteccao('camera', 54, baseTs + 800, 14, true, 98);
  assert(res7.candidateResult.candidato === null, `Candidate is null for score 54% (got '${res7.candidateResult.candidato}')`);

  // ----------------------------------------------------
  // TEST 8: Full Sequence 67% -> 72% -> 79% -> 83% -> 87% -> 88% -> 89%
  // ----------------------------------------------------
  console.log('\n--- TEST 8: Full Evolution Sequence ---');
  const analyzerSeq = new WheelVisionAnalyzer(3, 85);

  const sequence = [
    { score: 67, gap: 1, expectedConf: 0 },
    { score: 72, gap: 2, expectedConf: 0 },
    { score: 79, gap: 3, expectedConf: 0 },
    { score: 83, gap: 3, expectedConf: 0 },
    { score: 87, gap: 5, expectedConf: 1 },
    { score: 88, gap: 6, expectedConf: 2 },
    { score: 89, gap: 7, expectedConf: 3 },
  ];

  let seqPassed = true;
  for (let i = 0; i < sequence.length; i++) {
    const step = sequence[i];
    const res = analyzerSeq.processarDeteccao('camera', step.score, baseTs + 1000 + i * 100, step.gap, true, 100 + i);
    if (res.candidateResult.candidato !== 'camera' && res.status !== 'confirmado') {
      console.error(`Frame ${i+1} (${step.score}%): Expected candidate 'camera', got '${res.candidateResult.candidato}'`);
      seqPassed = false;
    }
    if (i < 4 && res.candidateResult.confirmacoesConsecutivas !== step.expectedConf) {
      console.error(`Frame ${i+1} (${step.score}%): Expected confirmations ${step.expectedConf}, got ${res.candidateResult.confirmacoesConsecutivas}`);
      seqPassed = false;
    }
    if (i === sequence.length - 1 && res.status !== 'confirmado') {
      console.error(`Final Frame (${step.score}%): Expected status 'confirmado', got '${res.status}'`);
      seqPassed = false;
    }
  }
  assert(seqPassed, `Full sequence 67% -> 89% maintained candidate continuity and confirmed at 89%`);

  console.log('\n====================================================');
  console.log(` SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
