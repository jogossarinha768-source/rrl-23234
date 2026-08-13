import { WheelObjectVisualMatcher } from '../services/WheelObjectVisualMatcher';
import { LocalWheelRecognizer } from '../services/LocalWheelRecognizer';
import { WHEEL_OBJECT_REFERENCES, ALLOWED_WHEEL_OBJECTS, WheelObjectName } from '../config/wheelObjectReferences';
import sharp from 'sharp';

async function generateTestCrop(objName: WheelObjectName, jpegQuality = 80): Promise<string> {
  const ref = WHEEL_OBJECT_REFERENCES[objName];
  const response = await fetch(ref.imageUrl);
  const buf = Buffer.from(await response.arrayBuffer());

  // Simular crop real 153x153 com pequena variação de cor e compressão JPEG
  const cropBuf = await sharp(buf)
    .resize(153, 153, { fit: 'cover' })
    .modulate({ brightness: 0.98, saturation: 1.02 })
    .jpeg({ quality: jpegQuality })
    .toBuffer();

  return `data:image/jpeg;base64,${cropBuf.toString('base64')}`;
}

async function generateEmptyCrop(): Promise<string> {
  const buf = await sharp({
    create: { width: 153, height: 153, channels: 3, background: { r: 20, g: 25, b: 35 } },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
  return `data:image/jpeg;base64,${buf.toString('base64')}`;
}

async function generateNoiseCrop(): Promise<string> {
  // Crop com ruído/fundo sem símbolo
  const raw = Buffer.alloc(153 * 153 * 3);
  for (let i = 0; i < raw.length; i++) {
    raw[i] = Math.floor(Math.random() * 50);
  }
  const buf = await sharp(raw, { raw: { width: 153, height: 153, channels: 3 } })
    .jpeg({ quality: 75 })
    .toBuffer();
  return `data:image/jpeg;base64,${buf.toString('base64')}`;
}

export async function runRealCropMatrixTest() {
  console.log('================================================================');
  console.log('=== [MATRIZ 8x8] TESTE DE MATRIZ DE RECONHECIMENTO VISUAL LOCAL ===');
  console.log('================================================================\n');

  LocalWheelRecognizer.updateConfig({ LOCAL_RECOGNITION_DEBUG: false });
  await LocalWheelRecognizer.warmup();

  // 1. Gerar crops para os 8 objetos
  const crops: Record<WheelObjectName, string> = {} as any;
  for (const obj of ALLOWED_WHEEL_OBJECTS) {
    crops[obj] = await generateTestCrop(obj);
  }

  // 2. Executar Matriz 8x8
  console.log('MATRIZ DE SCORES (Crops Reais vs 8 Referências):\n');

  // Cabeçalho da matriz
  let header = 'CROP \\ REF  |';
  for (const refObj of ALLOWED_WHEEL_OBJECTS) {
    header += ` ${refObj.padStart(8)} |`;
  }
  console.log(header);
  console.log('-'.repeat(header.length));

  const matrixResults: Record<string, Record<string, number>> = {};

  for (const cropObj of ALLOWED_WHEEL_OBJECTS) {
    matrixResults[cropObj] = {};
    const res = await WheelObjectVisualMatcher.findBestVisualMatchAsync(crops[cropObj]);
    let line = `${cropObj.padEnd(11)} |`;

    for (const refObj of ALLOWED_WHEEL_OBJECTS) {
      const score = res.scoresPorObjeto?.[refObj] ?? 0;
      matrixResults[cropObj][refObj] = score;
      line += ` ${score.toFixed(1).padStart(8)} |`;
    }
    console.log(line);
  }

  console.log('-'.repeat(header.length));

  // 3. Avaliar Reconhecimento dos 8 Objetos Reais
  console.log('\n--- EVALUAÇÃO DOS 8 OBJETOS REAIS ---');
  let correctCount = 0;
  for (const cropObj of ALLOWED_WHEEL_OBJECTS) {
    const recRes = await LocalWheelRecognizer.recognizeCrop(crops[cropObj], true);
    const isWinnerCorrect = recRes.candidato1 === cropObj;
    const isAccepted = recRes.accepted && recRes.objetoDetectado === cropObj;
    const pass = isWinnerCorrect && isAccepted;
    if (pass) correctCount++;

    console.log(
      `[${pass ? 'PASS' : 'FAIL'}] Esperado: ${cropObj.padEnd(8)} | ` +
      `Winner: ${recRes.candidato1.padEnd(8)} (${(recRes.score1 * 100).toFixed(1)}%) | ` +
      `2º: ${recRes.candidato2.padEnd(8)} (${(recRes.score2 * 100).toFixed(1)}%) | ` +
      `Gap: ${(recRes.gap * 100).toFixed(1)}% | ` +
      `Accepted: ${recRes.accepted} (${recRes.reason})`
    );
  }

  // 4. Teste de Falsos Positivos (Controle Negativo)
  console.log('\n--- TESTE DE FALSOS POSITIVOS ---');
  const emptyCrop = await generateEmptyCrop();
  const emptyRes = await LocalWheelRecognizer.recognizeCrop(emptyCrop, true);
  const emptyPass = !emptyRes.accepted && emptyRes.objetoDetectado === 'nenhum';
  console.log(`Crop Vazio/Fundo: winner=${emptyRes.candidato1} score=${(emptyRes.score1 * 100).toFixed(1)}% accepted=${emptyRes.accepted} -> ${emptyPass ? 'PASS (nenhum)' : 'FAIL'}`);

  const noiseCrop = await generateNoiseCrop();
  const noiseRes = await LocalWheelRecognizer.recognizeCrop(noiseCrop, true);
  const noisePass = !noiseRes.accepted && noiseRes.objetoDetectado === 'nenhum';
  console.log(`Crop Ruído: winner=${noiseRes.candidato1} score=${(noiseRes.score1 * 100).toFixed(1)}% accepted=${noiseRes.accepted} -> ${noisePass ? 'PASS (nenhum)' : 'FAIL'}`);

  // 5. Teste de Compressão JPEG
  console.log('\n--- TESTE DE COMPRESSÃO JPEG (sorvete) ---');
  const qualities = [100, 90, 85, 75, 60];
  let jpegPassCount = 0;
  for (const q of qualities) {
    const qCrop = await generateTestCrop('sorvete', q);
    const qRes = await LocalWheelRecognizer.recognizeCrop(qCrop, true);
    const qPass = qRes.accepted && qRes.objetoDetectado === 'sorvete';
    if (qPass) jpegPassCount++;
    console.log(`JPEG Q=${q}%: winner=${qRes.candidato1} score=${(qRes.score1 * 100).toFixed(1)}% gap=${(qRes.gap * 100).toFixed(1)}% accepted=${qRes.accepted}`);
  }

  // 6. Teste de Escala
  console.log('\n--- TESTE DE ESCALA (sorvete) ---');
  const scales = [1.0, 0.95, 0.90, 0.85, 0.80];
  let scalePassCount = 0;
  for (const s of scales) {
    const refBuf = Buffer.from(await (await fetch(WHEEL_OBJECT_REFERENCES.sorvete.imageUrl)).arrayBuffer());
    const scaledSize = Math.round(153 * s);
    const scaledBuf = await sharp(refBuf).resize(scaledSize, scaledSize, { fit: 'contain' }).toBuffer();
    const paddedCrop = await sharp({ create: { width: 153, height: 153, channels: 3, background: { r: 0, g: 0, b: 0 } } })
      .composite([{ input: scaledBuf, top: Math.floor((153 - scaledSize) / 2), left: Math.floor((153 - scaledSize) / 2) }])
      .jpeg({ quality: 80 })
      .toBuffer();
    const dataUrl = `data:image/jpeg;base64,${paddedCrop.toString('base64')}`;
    const sRes = await LocalWheelRecognizer.recognizeCrop(dataUrl, true);
    const sPass = sRes.accepted && sRes.objetoDetectado === 'sorvete';
    if (sPass) scalePassCount++;
    console.log(`Escala ${(s * 100).toFixed(0)}%: winner=${sRes.candidato1} score=${(sRes.score1 * 100).toFixed(1)}% gap=${(sRes.gap * 100).toFixed(1)}% accepted=${sRes.accepted}`);
  }

  console.log('\n================================================================');
  console.log(`RESUMO DA MATRIZ: ${correctCount}/8 OBJETOS APROVADOS`);
  console.log(`FALSOS POSITIVOS: ${emptyPass && noisePass ? 'APROVADO' : 'FALHOU'}`);
  console.log(`COMPRESSÃO JPEG: ${jpegPassCount}/${qualities.length} APROVADOS`);
  console.log(`ESCALA: ${scalePassCount}/${scales.length} APROVADOS`);
  console.log('================================================================\n');

  return { correctCount, emptyPass, noisePass, jpegPassCount, scalePassCount };
}

import { fileURLToPath } from 'url';
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runRealCropMatrixTest().catch((err) => {
    console.error('Erro na matriz:', err);
    process.exit(1);
  });
}
