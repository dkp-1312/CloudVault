const API_BASE = 'https://api.imagekit.io/v1';
const PRIVATE_KEY = process.env.VITE_IMAGEKIT_PRIVATE_KEY;

function getAuthHeader() {
  const credentials = Buffer.from(`${PRIVATE_KEY}:`).toString('base64');
  return `Basic ${credentials}`;
}

async function test1() {
  console.log('--- TEST 1: /files?type=folder ---');
  const res = await fetch(`${API_BASE}/files?type=folder&path=/&limit=50`, {
    headers: { Authorization: getAuthHeader() },
  });
  console.log('Status:', res.status);
  const data = await res.json();
  console.log('Count:', data.length);
}

async function test2() {
  console.log('--- TEST 2: /folders ---');
  const res = await fetch(`${API_BASE}/folders?parentFolderPath=/&limit=50`, {
    headers: { Authorization: getAuthHeader() },
  });
  console.log('Status:', res.status);
  const data = await res.json();
  console.log('Count:', Array.isArray(data) ? data.length : data);
}

async function main() {
  await test1();
  await test2();
}

main();
