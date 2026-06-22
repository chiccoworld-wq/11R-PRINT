const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

let _sb;
function sb() {
  if (!_sb) _sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  return _sb;
}

const PW = () => process.env.ADMIN_PASSWORD;

function res(status, body, extra = {}) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, x-admin-key',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      ...extra
    },
    body: JSON.stringify(body)
  };
}

function auth(headers) {
  const key = headers['x-admin-key'] || headers['X-Admin-Key'] || '';
  return key === PW() && !!PW();
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return res(204, {});

  const path = event.path
    .replace(/^\/.netlify\/functions\/api/, '')
    .replace(/^\/api/, '') || '/';
  const method = event.httpMethod;
  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch {}

  // POST /login
  if (path === '/login' && method === 'POST') {
    if (body.password === PW() && PW()) return res(200, { ok: true });
    return res(401, { error: 'Wrong password' });
  }

  // POST /send-otp — email verification code to admin
  if (path === '/send-otp' && method === 'POST') {
    const RESEND_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_KEY) return res(500, { error: 'Email not configured' });

    const seed = 'admin';
    const window = Math.floor(Date.now() / 300000);
    const hash = crypto.createHmac('sha256', PW()).update(`${seed}:${window}`).digest('hex');
    const code = String(parseInt(hash.slice(0, 8), 16) % 1000000).padStart(6, '0');

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'noreply@11rprint.com',
        to: 'orders@11rprint.com',
        subject: '11R Print Admin — Sign In Code',
        text: `Your sign-in code is: ${code}\n\nThis code expires in 5 minutes.`
      })
    }).catch(() => null);

    if (!emailRes || !emailRes.ok) return res(500, { error: 'Failed to send email' });
    return res(200, { ok: true });
  }

  // POST /verify-otp — verify email code and return session key
  if (path === '/verify-otp' && method === 'POST') {
    const otp = String(body.otp || '').trim();
    const seed = 'admin';
    const now = Math.floor(Date.now() / 300000);
    const expected = (w) => {
      const hash = crypto.createHmac('sha256', PW()).update(`${seed}:${w}`).digest('hex');
      return String(parseInt(hash.slice(0, 8), 16) % 1000000).padStart(6, '0');
    };

    if (otp !== expected(now) && otp !== expected(now - 1)) {
      return res(401, { error: 'Invalid or expired code' });
    }
    return res(200, { ok: true, key: PW() });
  }

  // POST /forgot-password — email password to admin
  if (path === '/forgot-password' && method === 'POST') {
    const RESEND_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_KEY) return res(500, { error: 'Email not configured. Add RESEND_API_KEY to env.' });

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'noreply@11rprint.com',
        to: 'orders@11rprint.com',
        subject: '11R Print Admin — Password Recovery',
        text: `Your 11R Print admin password is:\n\n${PW()}\n\nKeep this secure.`
      })
    }).catch(() => null);

    if (!emailRes || !emailRes.ok) return res(500, { error: 'Failed to send email' });
    return res(200, { ok: true });
  }

  // GET /proofs — list (admin)
  if (path === '/proofs' && method === 'GET') {
    if (!auth(event.headers)) return res(401, { error: 'Unauthorized' });
    const { data, error } = await sb()
      .from('proofs')
      .select('id,token,customer_name,customer_email,customer_phone,status,created_at,approved_at,approved_by_name')
      .order('created_at', { ascending: false });
    if (error) return res(500, { error: error.message });
    return res(200, { proofs: data });
  }

  // POST /proofs — create (admin)
  if (path === '/proofs' && method === 'POST') {
    if (!auth(event.headers)) return res(401, { error: 'Unauthorized' });
    const { customer_name, customer_email, customer_phone, mockup_urls, pricing_items, deposit_amount, order_notes, policy_text } = body;
    if (!customer_name || !customer_email) return res(400, { error: 'Name and email required' });

    const token = crypto.randomBytes(22).toString('hex');
    const { data, error } = await sb()
      .from('proofs')
      .insert([{ token, customer_name, customer_email, customer_phone: customer_phone || null, mockup_urls: mockup_urls || [], pricing_items: pricing_items || [], deposit_amount: deposit_amount || null, order_notes: order_notes || null, policy_text: policy_text || '', status: 'pending' }])
      .select()
      .single();
    if (error) return res(500, { error: error.message });
    return res(200, { proof: data });
  }

  // GET /proofs/:token — fetch single (public)
  const tokGet = path.match(/^\/proofs\/([a-f0-9]+)$/);
  if (tokGet && method === 'GET') {
    const { data, error } = await sb()
      .from('proofs')
      .select('token,customer_name,customer_phone,mockup_urls,pricing_items,deposit_amount,order_notes,policy_text,status,created_at,approved_at,approved_by_name')
      .eq('token', tokGet[1])
      .single();
    if (error || !data) return res(404, { error: 'Proof not found' });
    return res(200, { proof: data });
  }

  // DELETE /proofs/:token (admin)
  const tokDel = path.match(/^\/proofs\/([a-f0-9]+)$/);
  if (tokDel && method === 'DELETE') {
    if (!auth(event.headers)) return res(401, { error: 'Unauthorized' });
    const { error } = await sb().from('proofs').delete().eq('token', tokDel[1]);
    if (error) return res(500, { error: error.message });
    return res(200, { ok: true });
  }

  // POST /proofs/:token/approve (public)
  const tokApprove = path.match(/^\/proofs\/([a-f0-9]+)\/approve$/);
  if (tokApprove && method === 'POST') {
    const { name } = body;
    if (!name || name.trim().length < 2) return res(400, { error: 'Full name required' });
    const ip = (event.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';

    const { data, error } = await sb()
      .from('proofs')
      .update({ status: 'approved', approved_at: new Date().toISOString(), approved_by_name: name.trim(), approved_ip: ip })
      .eq('token', tokApprove[1])
      .eq('status', 'pending')
      .select()
      .single();
    if (error || !data) return res(409, { error: 'Not found or already processed' });
    return res(200, { ok: true, proof: data });
  }

  // POST /upload-url — signed upload URL (admin)
  if (path === '/upload-url' && method === 'POST') {
    if (!auth(event.headers)) return res(401, { error: 'Unauthorized' });
    const { filename } = body;
    if (!filename) return res(400, { error: 'filename required' });
    const ext = filename.split('.').pop().toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf'].includes(ext)) return res(400, { error: 'File type not allowed' });

    const key = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
    const { data, error } = await sb().storage.from('proof-mockups').createSignedUploadUrl(key);
    if (error) return res(500, { error: error.message });

    const { data: { publicUrl } } = sb().storage.from('proof-mockups').getPublicUrl(key);
    return res(200, { signedUrl: data.signedUrl, token: data.token, publicUrl });
  }

  // POST /order-upload-url — signed upload for customer order files (PUBLIC)
  if (path === '/order-upload-url' && method === 'POST') {
    const { filename } = body;
    if (!filename) return res(400, { error: 'filename required' });
    const ext = filename.split('.').pop().toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'pdf'].includes(ext)) return res(400, { error: 'File type not allowed' });

    const key = `orders/${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
    const { data, error } = await sb().storage.from('proof-mockups').createSignedUploadUrl(key);
    if (error) return res(500, { error: error.message });

    const { data: { publicUrl } } = sb().storage.from('proof-mockups').getPublicUrl(key);
    return res(200, { signedUrl: data.signedUrl, token: data.token, publicUrl });
  }

  // POST /orders — create customer order from the mockup builder (PUBLIC)
  if (path === '/orders' && method === 'POST') {
    const o = body;
    if (!o.customer_name) return res(400, { error: 'Name required' });
    if (!o.customer_email && !o.customer_phone) return res(400, { error: 'Email or phone required' });

    const { data, error } = await sb()
      .from('orders')
      .insert([{
        customer_name: o.customer_name,
        customer_email: o.customer_email || null,
        customer_phone: o.customer_phone || null,
        customer_company: o.customer_company || null,
        product: o.product || null,
        shirt_color: o.shirt_color || null,
        print_location: o.print_location || null,
        ink_colors: o.ink_colors || null,
        quantity: o.quantity || null,
        sizes: o.sizes || {},
        deadline: o.deadline || null,
        notes: o.notes || null,
        artwork_filename: o.artwork_filename || null,
        artwork_url: o.artwork_url || null,
        mockup_url: o.mockup_url || null,
        placement: o.placement || {},
        estimate: o.estimate || {},
        status: 'new'
      }])
      .select()
      .single();
    if (error) return res(500, { error: error.message });

    // Fire-and-forget email notification (if Resend configured)
    const RESEND_KEY = process.env.RESEND_API_KEY;
    if (RESEND_KEY) {
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'noreply@11rprint.com',
          to: 'orders@11rprint.com',
          subject: `New Custom Order — ${o.customer_name}`,
          text: `New mockup order from ${o.customer_name}\n\nProduct: ${o.product || '—'}\nColor: ${o.shirt_color || '—'}\nLocation: ${o.print_location || '—'}\nQuantity: ${o.quantity || '—'}\nContact: ${o.customer_email || ''} ${o.customer_phone || ''}\nEst. Total: ${(o.estimate && o.estimate.total) || '—'}\n\nView full details + images in your admin dashboard:\nhttps://11rprint.com/admin/`
        })
      }).catch(() => {});
    }

    return res(200, { order: data });
  }

  // GET /orders — list customer orders (admin)
  if (path === '/orders' && method === 'GET') {
    if (!auth(event.headers)) return res(401, { error: 'Unauthorized' });
    const { data, error } = await sb()
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return res(500, { error: error.message });
    return res(200, { orders: data });
  }

  // DELETE /orders/:id (admin)
  const ordDel = path.match(/^\/orders\/([a-f0-9-]+)$/);
  if (ordDel && method === 'DELETE') {
    if (!auth(event.headers)) return res(401, { error: 'Unauthorized' });
    const { error } = await sb().from('orders').delete().eq('id', ordDel[1]);
    if (error) return res(500, { error: error.message });
    return res(200, { ok: true });
  }

  return res(404, { error: 'Not found' });
};
