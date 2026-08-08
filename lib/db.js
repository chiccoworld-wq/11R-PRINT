const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

let _client;
function postgresClient() {
  if (!_client) {
    _client = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _client;
}

const STORAGE_BUCKET = 'proof-mockups';
const STORAGE_SECRET = process.env.STORAGE_SECRET || crypto.randomBytes(32).toString('hex');

function verifyStorageToken(key, exp, token) {
  if (!key || !exp || !token) return false;
  if (Date.now() > parseInt(exp, 10)) return false;
  const expected = crypto.createHmac('sha256', STORAGE_SECRET)
    .update(`${key}:${exp}`)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(token, 'hex'));
  } catch {
    return false;
  }
}

async function saveStorageObject(key, buffer) {
  const { error } = await postgresClient()
    .storage
    .from(STORAGE_BUCKET)
    .upload(key, buffer, { upsert: true });
  if (error) throw new Error(error.message);
}

function safeStoragePath(key) {
  const { data } = postgresClient()
    .storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(key);
  return data?.publicUrl || null;
}

module.exports = {
  db: postgresClient,
  verifyStorageToken,
  saveStorageObject,
  safeStoragePath,
};
