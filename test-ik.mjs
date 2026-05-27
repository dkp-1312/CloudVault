const API_BASE = 'https://api.imagekit.io/v1';
const PRIVATE_KEY = process.env.VITE_IMAGEKIT_PRIVATE_KEY;

function getAuthHeader() {
  const credentials = Buffer.from(`${PRIVATE_KEY}:`).toString('base64');
  return `Basic ${credentials}`;
}

async function testListFolders() {
  const url = new URL(`${API_BASE}/files`);
  url.searchParams.set('type', 'folder');
  url.searchParams.set('path', '/');
  url.searchParams.set('limit', '50');

  console.log('Fetching', url.toString());

  const res = await fetch(url.toString(), {
    headers: { Authorization: getAuthHeader() },
  });

  console.log('Status:', res.status, res.statusText);
  const data = await res.json();
  console.log('Data:', JSON.stringify(data, null, 2));
}

testListFolders();
