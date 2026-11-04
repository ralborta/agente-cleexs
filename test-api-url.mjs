#!/usr/bin/env node

/**
 * Script de prueba: verifica que cleexsApiUrl() preserva prefijos de ruta.
 */

function cleexsApiUrl(envValue) {
  let raw = (envValue || 'https://cleexsapi-production.up.railway.app').trim();
  if (raw && !/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  const base = raw.replace(/\/+$/, '');
  try {
    const u = new URL(base);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      throw new Error(`protocolo inválido: ${u.protocol}`);
    }
    const path = u.pathname !== '/' ? u.pathname : '';
    return `${u.protocol}//${u.host}${path}`;
  } catch (e) {
    throw new Error(
      `CLEEXS_API_URL inválida (${JSON.stringify(envValue || '')}). ${e.message}`,
    );
  }
}

const tests = [
  {
    input: 'https://app.cleexs.net/proxy-api',
    expected: 'https://app.cleexs.net/proxy-api',
    description: 'URL con prefijo de ruta',
  },
  {
    input: 'https://app.cleexs.net/proxy-api/',
    expected: 'https://app.cleexs.net/proxy-api',
    description: 'URL con prefijo y trailing slash (se elimina)',
  },
  {
    input: 'https://cleexsapi-production.up.railway.app',
    expected: 'https://cleexsapi-production.up.railway.app',
    description: 'URL sin path (comportamiento anterior)',
  },
  {
    input: 'cleexsapi-production.up.railway.app',
    expected: 'https://cleexsapi-production.up.railway.app',
    description: 'Host sin protocolo (se agrega https)',
  },
  {
    input: 'app.cleexs.net/proxy-api',
    expected: 'https://app.cleexs.net/proxy-api',
    description: 'Host + path sin protocolo',
  },
  {
    input: '',
    expected: 'https://cleexsapi-production.up.railway.app',
    description: 'Vacío (usa default)',
  },
];

console.log('🧪 Probando construcción de URLs de la API de Cleexs\n');

let passed = 0;
let failed = 0;

for (const test of tests) {
  try {
    const result = cleexsApiUrl(test.input);
    if (result === test.expected) {
      console.log(`✅ ${test.description}`);
      console.log(`   Input:    "${test.input}"`);
      console.log(`   Output:   "${result}"\n`);
      passed++;
    } else {
      console.log(`❌ ${test.description}`);
      console.log(`   Input:    "${test.input}"`);
      console.log(`   Expected: "${test.expected}"`);
      console.log(`   Got:      "${result}"\n`);
      failed++;
    }
  } catch (e) {
    console.log(`❌ ${test.description}`);
    console.log(`   Input:    "${test.input}"`);
    console.log(`   Error:    ${e.message}\n`);
    failed++;
  }
}

console.log(`\n${'='.repeat(60)}`);
console.log(`Resultados: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}

console.log('\n✅ Todas las pruebas pasaron');

// Prueba de construcción de URL completa para fetch
console.log('\n📡 Prueba de construcción de URL completa:');
const baseUrl = cleexsApiUrl('https://app.cleexs.net/proxy-api');
const fullUrl = `${baseUrl}/api/brands/test-id`;
console.log(`   Base:     "${baseUrl}"`);
console.log(`   Full URL: "${fullUrl}"`);
console.log(`   Expected: "https://app.cleexs.net/proxy-api/api/brands/test-id"`);

if (fullUrl === 'https://app.cleexs.net/proxy-api/api/brands/test-id') {
  console.log('   ✅ Construcción correcta\n');
} else {
  console.log('   ❌ Construcción incorrecta\n');
  process.exit(1);
}
