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
    const estTotal = o.estimate?.total != null ? '$' + parseFloat(o.estimate.total).toFixed(2) : '—';
    if (RESEND_KEY) {
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'noreply@11rprint.com',
          to: 'orders@11rprint.com',
          subject: `New Custom Order — ${o.customer_name}`,
          text: `New mockup order from ${o.customer_name}\n\nProduct: ${o.product || '—'}\nColor: ${o.shirt_color || '—'}\nLocation: ${o.print_location || '—'}\nQuantity: ${o.quantity || '—'}\nContact: ${o.customer_email || ''} ${o.customer_phone || ''}\nEst. Total: ${estTotal}\n\nView full details + images in your admin dashboard:\nhttps://11rprint.com/admin/`
        })
      }).catch(() => {});
    }

    // Fire-and-forget n8n webhook (if configured)
    const N8N_URL = process.env.N8N_WEBHOOK_URL;
    if (N8N_URL) {
      const n8nHeaders = { 'Content-Type': 'application/json' };
      if (process.env.N8N_API_KEY) n8nHeaders['X-N8N-API-KEY'] = process.env.N8N_API_KEY;
      fetch(N8N_URL, {
        method: 'POST',
        headers: n8nHeaders,
        body: JSON.stringify({
          event: 'new_quote',
          order_id: data.id,
          customer_name: o.customer_name,
          customer_email: o.customer_email || '',
          customer_phone: o.customer_phone || '',
          customer_company: o.customer_company || '',
          product: o.product || '',
          shirt_color: o.shirt_color || '',
          print_location: o.print_location || '',
          ink_colors: o.ink_colors || 0,
          quantity: o.quantity || 0,
          sizes: o.sizes || {},
          deadline: o.deadline || '',
          notes: o.notes || '',
          artwork_url: o.artwork_url || null,
          mockup_url: o.mockup_url || null,
          estimate_total: estTotal,
          estimate: o.estimate || {},
          created_at: new Date().toISOString(),
        })
      }).catch(() => {});
    }

    return res(200, { order: data });
  }

  // GET /orders/:id/pdf — generate PDF for an order (PUBLIC)
  const pdfMatch = path.match(/^\/orders\/([a-f0-9-]+)\/pdf$/);
  if (pdfMatch && method === 'GET') {
    const orderId = pdfMatch[1];
    try {
      const puppeteer = require('puppeteer-core');
      const chromium = require('@sparticuz/chromium');

      const { data: order, error } = await sb()
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (error || !order) return res(404, { error: 'Order not found' });

      const generateQuoteHTML = (o) => {
        const formatPrice = (n) => '$' + (parseFloat(n) || 0).toFixed(2);
        const mockupImg = o.mockup_url ? `<img src="${o.mockup_url}" alt="Design mockup" style="max-width: 100%; height: auto; border-radius: 8px; margin-bottom: 20px;">` : '';
        const sizes = o.sizes ? Object.entries(o.sizes).map(([size, qty]) => `${size}: ${qty}`).join(', ') : '—';

        return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;color:#333;background:white}container{max-width:8.5in;height:11in;margin:0 auto;padding:0.5in;background:white}header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:30px;border-bottom:2px solid #000;padding-bottom:20px}.logo{font-size:28px;font-weight:bold;color:#000}.logo-sub{font-size:11px;color:#666;margin-top:4px}.header-right{text-align:right;font-size:13px}.header-right div{margin-bottom:8px}h1{font-size:24px;margin-bottom:20px;color:#000}.quote-meta{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:30px}.meta-section{font-size:12px}.meta-label{font-weight:bold;color:#666;margin-bottom:4px}.meta-value{color:#000}.mockup{margin-bottom:25px}.mockup img{max-width:100%;height:auto;border-radius:8px}table{width:100%;border-collapse:collapse;margin-bottom:25px}th{background:#f5f5f5;padding:10px;text-align:left;font-size:12px;font-weight:bold;border-bottom:1px solid #ddd}td{padding:10px;font-size:12px;border-bottom:1px solid #eee}.pricing{margin-bottom:25px}.price-row{display:flex;justify-content:space-between;padding:8px 0;font-size:13px}.price-row.total{border-top:2px solid #000;padding-top:12px;font-weight:bold;font-size:14px}.footer{font-size:11px;color:#666;margin-top:30px;padding-top:20px;border-top:1px solid #ddd;line-height:1.6}</style></head><body><div class="container"><header><div><div class="logo">11R PRINT</div><div class="logo-sub">SCREEN PRINTED APPAREL</div></div><div class="header-right"><div><strong>Quote</strong></div><div>Created: ${new Date(o.created_at).toLocaleDateString()}</div></div></header><h1>Custom Screen Print Quote</h1><div class="quote-meta"><div class="meta-section"><div class="meta-label">Customer</div><div class="meta-value">${o.customer_name}</div>${o.customer_email ? `<div class="meta-value">${o.customer_email}</div>` : ''}${o.customer_phone ? `<div class="meta-value">${o.customer_phone}</div>` : ''}</div><div class="meta-section"><div class="meta-label">Quote ID</div><div class="meta-value">${o.id.slice(0, 8).toUpperCase()}</div></div></div>${mockupImg ? `<div class="mockup">${mockupImg}</div>` : ''}<table><tr><th>Item</th><th>Details</th></tr><tr><td><strong>Product</strong></td><td>${o.product || '—'}</td></tr><tr><td><strong>Color</strong></td><td>${o.shirt_color || '—'}</td></tr><tr><td><strong>Print Location</strong></td><td>${o.print_location || '—'}</td></tr><tr><td><strong>Quantity</strong></td><td>${o.quantity || '—'}</td></tr><tr><td><strong>Sizes</strong></td><td>${sizes}</td></tr><tr><td><strong>Ink Colors</strong></td><td>${Array.isArray(o.ink_colors) ? o.ink_colors.join(', ') : o.ink_colors || '—'}</td></tr><tr><td><strong>Deadline</strong></td><td>${o.deadline || 'To be discussed'}</td></tr></table><div class="pricing"><div class="price-row"><span>Setup Fee:</span><span>${formatPrice(o.estimate?.setup || 0)}</span></div><div class="price-row"><span>Per-Shirt Cost (×${o.quantity || 1}):</span><span>${formatPrice((parseFloat(o.estimate?.perShirt) || 0) * (o.quantity || 1))}</span></div><div class="price-row total"><span>Total Estimate:</span><span>${formatPrice(o.estimate?.total || 0)}</span></div></div>${o.notes ? `<div style="background:#f9f9f9;padding:15px;border-radius:4px;margin-bottom:20px;font-size:12px;"><strong>Notes:</strong><br>${o.notes}</div>` : ''}<div class="footer"><p><strong>Next Steps:</strong> Please review this quote and let us know if you'd like to move forward.</p><p style="margin-top:15px;">11R Print | Built With Passion. Printed With Purpose.<br><a href="https://11rprint.com">11rprint.com</a></p></div></div></body></html>`;
      };

      const html = generateQuoteHTML(order);
      const browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      });

      const page = await browser.createPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({ format: 'Letter', margin: { top: 0, right: 0, bottom: 0, left: 0 } });
      await browser.close();

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="quote.pdf"',
          'Access-Control-Allow-Origin': '*'
        },
        body: pdfBuffer.toString('base64'),
        isBase64Encoded: true
      };
    } catch (err) {
      console.error('PDF error:', err);
      return res(500, { error: 'PDF generation failed', details: err.message });
    }
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
