const { createClient } = require('@supabase/supabase-js');

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

module.exports = {
  db: postgresClient,
};
