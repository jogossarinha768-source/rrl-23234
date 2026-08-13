import { getSupabase } from '../database/supabase';

async function testSupabaseInsertAndSelect() {
  console.log('=== TEST SUPABASE INSERT & SELECT ===');
  const supabase = getSupabase();
  if (!supabase) {
    console.error('❌ Supabase client is NULL!');
    process.exit(1);
  }

  const testPayload = {
    sessao_id: 1,
    rodada: 999999,
    objeto: 'camera',
    confianca: 0.89,
    origem: 'gemini_live',
    status: 'confirmado',
    criado_em: new Date().toISOString(),
    horario_resultado: new Date().toISOString(),
  };

  console.log('Attempting INSERT:', testPayload);
  const { data: insertData, error: insertError } = await supabase
    .from('resultados')
    .insert([testPayload])
    .select()
    .single();

  if (insertError) {
    console.error('❌ INSERT Error:', insertError);
    process.exit(1);
  }

  console.log('✅ INSERT Success! Inserted Data:', insertData);

  console.log('Attempting SELECT verification by ID:', insertData.id);
  const { data: selectData, error: selectError } = await supabase
    .from('resultados')
    .select('*')
    .eq('id', insertData.id)
    .single();

  if (selectError) {
    console.error('❌ SELECT Verification Error:', selectError);
    process.exit(1);
  }

  console.log('✅ SELECT Verification Success! Found:', selectData);

  // Clean up test row
  console.log('Cleaning up test row id:', insertData.id);
  await supabase.from('resultados').delete().eq('id', insertData.id);
  console.log('Cleaned up!');
}

testSupabaseInsertAndSelect();
