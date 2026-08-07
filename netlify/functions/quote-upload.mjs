import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { db } = require('../../lib/db');

function sb() {
  return db();
}

export const handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'Method not allowed' }) };

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { name, type, data } = payload;
  if (!name || !type || !data) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Missing file data' }) };
  }

  const buf = Buffer.from(data, 'base64');
  const ts  = Date.now();
  const ext = name.split('.').pop().toLowerCase();
  const path = `quotes/${ts}-${name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  const { error } = await sb().storage.from('proof-mockups').upload(path, buf, {
    contentType: type,
    upsert: false,
  });

  if (error) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: error.message }) };
  }

  const { data: urlData } = sb().storage.from('proof-mockups').getPublicUrl(path);

  return {
    statusCode: 200,
    headers: { ...cors, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: urlData?.publicUrl || null, path }),
  };
};
