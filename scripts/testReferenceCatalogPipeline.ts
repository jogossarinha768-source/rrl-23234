import {
  OfficialResultReferenceCatalog,
  OfficialReferenceEntry,
} from '../src/services/OfficialResultReferenceCatalog';
import {
  WheelObjectVisualMatcher,
} from '../src/services/WheelObjectVisualMatcher';
import {
  ALLOWED_WHEEL_OBJECTS,
  OFFICIAL_RESULT_REFERENCE_DEFINITIONS,
  WheelObjectName,
} from '../src/config/wheelObjectReferences';

async function runTests() {
  console.log('===============================================================');
  console.log('TEST SUITE: OFICIAL RESULT REFERENCE CATALOG PIPELINE');
  console.log('===============================================================');

  let passedTests = 0;
  const totalTests = 8;

  // -------------------------------------------------------------
  // TEST 1: Catálogo Completo: 8/8 READY -> PASS
  // -------------------------------------------------------------
  console.log('\n--- TEST 1: Catálogo Completo (8/8 READY) ---');
  try {
    const catalog = await OfficialResultReferenceCatalog.loadAndValidateCatalog();
    if (catalog.length !== 8) {
      throw new Error(`Esperava 8 referências, mas obteve ${catalog.length}`);
    }

    const allReady = catalog.every((e) => e.status === 'READY' && e.valid && e.loaded && e.features);
    if (!allReady) {
      throw new Error('Nem todas as referências estão no estado READY');
    }

    console.log('✓ TEST 1 PASS: Catálogo oficial carregou 8/8 referências com status READY.');
    passedTests++;
  } catch (err: any) {
    console.error('✗ TEST 1 FAIL:', err?.message);
  }

  // -------------------------------------------------------------
  // TEST 2: Uma Imagem Ausente (7/8) -> CATALOG_INCOMPLETE
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Imagem Ausente (7/8 -> CATALOG_INCOMPLETE) ---');
  try {
    const validCatalog = await OfficialResultReferenceCatalog.loadAndValidateCatalog();
    const incompleteCatalog = validCatalog.slice(0, 7); // apenas 7

    try {
      OfficialResultReferenceCatalog.validateReferenceCatalog(incompleteCatalog);
      console.error('✗ TEST 2 FAIL: Deveria ter lançado erro CATALOG_INCOMPLETE.');
    } catch (err: any) {
      if (err.message.includes('CATALOG_INCOMPLETE')) {
        console.log('✓ TEST 2 PASS: Lançou erro esperado CATALOG_INCOMPLETE:', err.message);
        passedTests++;
      } else {
        console.error('✗ TEST 2 FAIL: Lançou erro com código incorreto:', err.message);
      }
    }
  } catch (err: any) {
    console.error('✗ TEST 2 FAIL:', err?.message);
  }

  // -------------------------------------------------------------
  // TEST 3: Imagem Duplicada (balao + balao -> DUPLICATE_REFERENCE_OBJECT)
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Imagem Duplicada (DUPLICATE_REFERENCE_OBJECT) ---');
  try {
    const validCatalog = await OfficialResultReferenceCatalog.loadAndValidateCatalog();
    const balaoEntry = validCatalog.find((e) => e.object === 'balao')!;
    const duplicateCatalog: OfficialReferenceEntry[] = [
      ...validCatalog.slice(0, 7),
      { ...balaoEntry }, // duplica balao no lugar do 8º
    ];

    try {
      OfficialResultReferenceCatalog.validateReferenceCatalog(duplicateCatalog);
      console.error('✗ TEST 3 FAIL: Deveria ter lançado erro DUPLICATE_REFERENCE_OBJECT.');
    } catch (err: any) {
      if (err.message.includes('DUPLICATE_REFERENCE_OBJECT')) {
        console.log('✓ TEST 3 PASS: Lançou erro esperado DUPLICATE_REFERENCE_OBJECT:', err.message);
        passedTests++;
      } else {
        console.error('✗ TEST 3 FAIL: Lançou erro com código incorreto:', err.message);
      }
    }
  } catch (err: any) {
    console.error('✗ TEST 3 FAIL:', err?.message);
  }

  // -------------------------------------------------------------
  // TEST 4: Imagem Carregada mas Features Inválidas -> FEATURES_INVALID
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Features Inválidas (FEATURES_INVALID) ---');
  try {
    const validCatalog = await OfficialResultReferenceCatalog.loadAndValidateCatalog();
    const corruptedCatalog: OfficialReferenceEntry[] = validCatalog.map((e, idx) => {
      if (idx === 0) {
        return {
          ...e,
          features: {
            ...e.features!,
            dHash: [], // esvazia dHash
          },
        };
      }
      return e;
    });

    try {
      OfficialResultReferenceCatalog.validateReferenceCatalog(corruptedCatalog);
      console.error('✗ TEST 4 FAIL: Deveria ter lançado erro FEATURES_INVALID.');
    } catch (err: any) {
      if (err.message.includes('FEATURES_INVALID')) {
        console.log('✓ TEST 4 PASS: Lançou erro esperado FEATURES_INVALID:', err.message);
        passedTests++;
      } else {
        console.error('✗ TEST 4 FAIL: Lançou erro com código incorreto:', err.message);
      }
    }
  } catch (err: any) {
    console.error('✗ TEST 4 FAIL:', err?.message);
  }

  // -------------------------------------------------------------
  // TEST 5: Consistência Única: Matcher recebe exatamente as 8 referências
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: Consistência Única (Matcher consome o mesmo catálogo) ---');
  try {
    const catalog = OfficialResultReferenceCatalog.getCatalog();
    const summary = OfficialResultReferenceCatalog.getDiagnosticSummary();

    if (summary.status !== 'VALID' || summary.featuresReadyCount !== 8) {
      throw new Error(`Summary inválido: status=${summary.status}, ready=${summary.featuresReadyCount}`);
    }

    const matcherStats = WheelObjectVisualMatcher.getReferenceCacheStats();
    console.log('Matcher Cache Stats:', matcherStats);

    if (matcherStats.referencesLoaded !== 8) {
      throw new Error(`Matcher carregou ${matcherStats.referencesLoaded}/8 referências`);
    }

    console.log('✓ TEST 5 PASS: Matcher e Catálogo compartilham rigorosamente as 8 referências oficiais.');
    passedTests++;
  } catch (err: any) {
    console.error('✗ TEST 5 FAIL:', err?.message);
  }

  // -------------------------------------------------------------
  // TEST 6: Auto-Reconhecimento (Crop de referência contra ela mesma > 90%)
  // -------------------------------------------------------------
  console.log('\n--- TEST 6: Auto-Reconhecimento de Todas as 8 Referências ---');
  try {
    let allMatched = true;
    for (const objName of ALLOWED_WHEEL_OBJECTS) {
      const def = OFFICIAL_RESULT_REFERENCE_DEFINITIONS[objName];
      const matchResult = await WheelObjectVisualMatcher.findBestVisualMatchAsync(def.imageUrl);

      console.log(
        `  -> ${objName.toUpperCase()}: Detected=${matchResult.simboloCandidatoVisual} ` +
        `Score=${matchResult.scoreVisual}% 2nd=${matchResult.segundoMelhorCandidato} ` +
        `Score2=${matchResult.scoreSegundoMelhor}% Gap=${matchResult.distanciaScoreComparacao}%`
      );

      if (matchResult.simboloCandidatoVisual !== objName || matchResult.scoreVisual < 85) {
        allMatched = false;
        console.error(`Falha no auto-reconhecimento de ${objName}`);
      }
    }

    if (allMatched) {
      console.log('✓ TEST 6 PASS: Todas as 8 referências reconheceram a si mesmas com score >= 85%.');
      passedTests++;
    } else {
      throw new Error('Falha no auto-reconhecimento de um ou mais símbolos.');
    }
  } catch (err: any) {
    console.error('✗ TEST 6 FAIL:', err?.message);
  }

  // -------------------------------------------------------------
  // TEST 7: Verificação Específica: balao, soco, tedy, camera
  // -------------------------------------------------------------
  console.log('\n--- TEST 7: Verificação Específica (balao, soco, tedy, camera) ---');
  try {
    const targets: WheelObjectName[] = ['balao', 'soco', 'tedy', 'camera'];
    let allTargetMatches = true;

    for (const t of targets) {
      const ref = OfficialResultReferenceCatalog.getReference(t);
      if (!ref || !ref.valid || ref.status !== 'READY') {
        allTargetMatches = false;
        console.error(`Referência inválida no catálogo para ${t}`);
        continue;
      }

      const match = await WheelObjectVisualMatcher.findBestVisualMatchAsync(ref.imageUrl);
      if (match.simboloCandidatoVisual !== t) {
        allTargetMatches = false;
        console.error(`Mismatch para ${t}: detectado=${match.simboloCandidatoVisual}`);
      }
    }

    if (allTargetMatches) {
      console.log('✓ TEST 7 PASS: balao, soco, tedy e camera verificados e perfeitamente discriminados.');
      passedTests++;
    } else {
      throw new Error('Falha nos alvos específicos.');
    }
  } catch (err: any) {
    console.error('✗ TEST 7 FAIL:', err?.message);
  }

  // -------------------------------------------------------------
  // TEST 8: Teste de Identidade de Referência
  // -------------------------------------------------------------
  console.log('\n--- TEST 8: Teste de Identidade de Referência ---');
  try {
    const catalog = OfficialResultReferenceCatalog.getCatalog();
    let identityOk = true;

    for (const entry of catalog) {
      const refDef = OFFICIAL_RESULT_REFERENCE_DEFINITIONS[entry.object];
      if (entry.imageUrl !== refDef.imageUrl || entry.referenceId !== refDef.referenceId) {
        identityOk = false;
        console.error(`Divergência de identidade para ${entry.object}`);
      }
    }

    if (identityOk) {
      console.log('✓ TEST 8 PASS: Identidade de referências verificada e consistente com o catálogo oficial.');
      passedTests++;
    } else {
      throw new Error('Divergência de identidade detectada.');
    }
  } catch (err: any) {
    console.error('✗ TEST 8 FAIL:', err?.message);
  }

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(`TEST SUITE RESULT: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('===============================================================');

  if (passedTests === totalTests) {
    console.log('🎉 TODOS OS TESTES PASSARAM COM SUCESSO!');
    process.exit(0);
  } else {
    console.error('❌ ALGUNS TESTES FALHARAM.');
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error running test suite:', err);
  process.exit(1);
});
