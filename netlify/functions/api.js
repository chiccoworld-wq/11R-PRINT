const { db } = require('../../lib/db');
const crypto = require('crypto');

let _db;
function sb() {
  if (!_db) _db = db();
  return _db;
}

const PW = () => process.env.ADMIN_PASSWORD;

// ── MODULE-LEVEL HELPERS ──────────────────────────────────────────────────

async function recalcInvoice(supabase, invoiceId) {
  const { data: items } = await supabase.from('invoice_items').select('quantity,unit_price').eq('invoice_id', invoiceId);
  if (!items) return;
  const subtotal = items.reduce((s, i) => s + (parseFloat(i.quantity)||1) * (parseFloat(i.unit_price)||0), 0);
  const { data: inv } = await supabase.from('invoices').select('tax_rate,deposit_type,deposit_value,amount_paid').eq('id', invoiceId).single();
  if (!inv) return;
  const taxAmount = subtotal * (parseFloat(inv.tax_rate) || 0);
  const total = subtotal + taxAmount;
  const depVal = parseFloat(inv.deposit_value) || 50;
  const depositRequired = inv.deposit_type === 'percent' ? total * (depVal / 100) : depVal;
  const balance = Math.max(0, total - (parseFloat(inv.amount_paid) || 0));
  await supabase.from('invoices').update({
    subtotal: parseFloat(subtotal.toFixed(2)),
    tax_amount: parseFloat(taxAmount.toFixed(2)),
    total: parseFloat(total.toFixed(2)),
    deposit_required: parseFloat(depositRequired.toFixed(2)),
    balance_due: parseFloat(balance.toFixed(2)),
    updated_at: new Date().toISOString()
  }).eq('id', invoiceId);
}

function buildReceiptEmail(snapshot, printUrl) {
  const s = snapshot;
  const amt = `$${parseFloat(s.payment.amount).toFixed(2)}`;
  const bal = `$${parseFloat(s.invoice.new_balance).toFixed(2)}`;
  const methodLabel = { cash:'Cash', card:'Credit/Debit Card', check:'Check', zelle:'Zelle', venmo:'Venmo', stripe:'Stripe', ach:'ACH' };
  const statusColor = s.status === 'PAID IN FULL' ? '#2e7d32' : s.status === 'DEPOSIT PAID' ? '#1565c0' : '#e65100';
  const statusBg = s.status === 'PAID IN FULL' ? '#e8f5e9' : s.status === 'DEPOSIT PAID' ? '#e3f2fd' : '#fff8e1';
  const statusBorder = s.status === 'PAID IN FULL' ? '#4caf50' : s.status === 'DEPOSIT PAID' ? '#2196f3' : '#ffc107';
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e0e0e0;">
<tr><td style="background:#050706;padding:24px 32px;">
  <img src="https://11rprint.com/images/11r-logo-new.png" alt="11R Print" style="height:36px;display:block;"/>
  <p style="margin:8px 0 0;color:#20ff7b;font-size:11px;font-weight:bold;letter-spacing:.14em;text-transform:uppercase;">Payment Receipt</p>
</td></tr>
<tr><td style="padding:32px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr>
    <td><h2 style="margin:0 0 4px;font-size:22px;color:#050706;">Receipt ${s.receipt_number}</h2>
      <p style="margin:0;font-size:13px;color:#888;">Invoice: ${s.invoice_number} &nbsp;|&nbsp; Payment: ${s.payment_number}</p>
      <p style="margin:4px 0 0;font-size:12px;color:#888;">Issued: ${new Date(s.issued_at).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</p>
    </td>
    <td align="right"><div style="background:${statusBg};border:1px solid ${statusBorder};padding:8px 16px;border-radius:999px;display:inline-block;">
      <p style="margin:0;font-size:10px;font-weight:bold;letter-spacing:.1em;text-transform:uppercase;color:${statusColor};">${s.status}</p>
    </div></td>
  </tr></table>

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-radius:8px;margin-bottom:20px;">
    <tr><td style="padding:10px 16px;font-size:12px;color:#888;width:150px;">Customer</td><td style="padding:10px 16px;font-size:14px;font-weight:bold;">${s.customer.name}${s.customer.company?' — '+s.customer.company:''}</td></tr>
    <tr><td style="padding:10px 16px;font-size:12px;color:#888;border-top:1px solid #eee;">Email</td><td style="padding:10px 16px;font-size:13px;border-top:1px solid #eee;">${s.customer.email||'—'}</td></tr>
    ${s.customer.billing_address?`<tr><td style="padding:10px 16px;font-size:12px;color:#888;border-top:1px solid #eee;">Address</td><td style="padding:10px 16px;font-size:13px;border-top:1px solid #eee;">${s.customer.billing_address}</td></tr>`:''}
  </table>

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-radius:8px;margin-bottom:20px;">
    <tr><td style="padding:10px 16px;font-size:12px;color:#888;width:150px;">Amount Received</td><td style="padding:10px 16px;font-size:20px;font-weight:bold;color:#058f45;">${amt}</td></tr>
    <tr><td style="padding:10px 16px;font-size:12px;color:#888;border-top:1px solid #eee;">Payment Method</td><td style="padding:10px 16px;font-size:13px;border-top:1px solid #eee;">${methodLabel[s.payment.method]||s.payment.method}</td></tr>
    <tr><td style="padding:10px 16px;font-size:12px;color:#888;border-top:1px solid #eee;">Payment Date</td><td style="padding:10px 16px;font-size:13px;border-top:1px solid #eee;">${new Date(s.payment.paid_at).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</td></tr>
    ${s.payment.reference?`<tr><td style="padding:10px 16px;font-size:12px;color:#888;border-top:1px solid #eee;">Reference #</td><td style="padding:10px 16px;font-size:13px;border-top:1px solid #eee;">${s.payment.reference}</td></tr>`:''}
  </table>

  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
    <tr><td style="padding:6px 0;color:#888;font-size:13px;">Invoice Total</td><td style="padding:6px 0;text-align:right;font-size:13px;">$${parseFloat(s.invoice.total).toFixed(2)}</td></tr>
    <tr><td style="padding:6px 0;color:#888;font-size:13px;">Previous Payments</td><td style="padding:6px 0;text-align:right;font-size:13px;">$${parseFloat(s.invoice.prior_paid).toFixed(2)}</td></tr>
    <tr><td style="padding:6px 0;color:#888;font-size:13px;">This Payment</td><td style="padding:6px 0;text-align:right;font-size:13px;color:#058f45;font-weight:bold;">${amt}</td></tr>
    <tr><td style="padding:10px 0 6px;font-size:15px;font-weight:bold;border-top:2px solid #eee;">Remaining Balance</td><td style="padding:10px 0 6px;text-align:right;font-size:15px;font-weight:bold;color:${parseFloat(s.invoice.new_balance)===0?'#058f45':'#333'};border-top:2px solid #eee;">${bal}</td></tr>
  </table>

  <a href="${printUrl}" style="display:inline-block;background:#050706;color:#20ff7b;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:bold;letter-spacing:.06em;">View &amp; Print Receipt</a>
  <p style="margin:24px 0 0;font-size:12px;color:#999;line-height:1.6;">Thank you for your business! Questions? Email <a href="mailto:orders@11rprint.com" style="color:#058f45;">orders@11rprint.com</a></p>
  <p style="margin:8px 0 0;font-size:11px;color:#ccc;">Verification: ${s.receipt_number}</p>
</td></tr>
<tr><td style="background:#f9f9f9;padding:16px 32px;border-top:1px solid #eee;">
  <p style="margin:0;font-size:12px;color:#999;">11R Print &nbsp;·&nbsp; Built With Passion. Printed With Purpose. &nbsp;·&nbsp; <a href="https://11rprint.com" style="color:#058f45;text-decoration:none;">11rprint.com</a></p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

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

async function forwardQuoteToNexus(payload, source) {
  const nexusIntakeUrl = process.env.NEXUS_INSTANT_QUOTE_URL || 'https://nexus.11rprint.com/api/public/instant-quote';
  if (!nexusIntakeUrl) return false;
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.NEXUS_INTAKE_SECRET) headers['X-11R-Nexus-Secret'] = process.env.NEXUS_INTAKE_SECRET;
  try {
    const response = await fetch(nexusIntakeUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...payload, source }),
    });
    if (!response.ok) console.error('Nexus CRM intake error:', response.status, await response.text());
    return response.ok;
  } catch (err) {
    console.error('Nexus CRM intake failed:', err);
    return false;
  }
}

async function forwardHomepageQuoteToN8n(q) {
  const n8nWebhookUrl = process.env.N8N_INSTANT_QUOTE_WEBHOOK_URL || process.env.N8N_WEBHOOK_URL;
  if (!n8nWebhookUrl) return false;
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.N8N_WEBHOOK_SECRET) headers['X-11R-Webhook-Secret'] = process.env.N8N_WEBHOOK_SECRET;
  const firstName = String(q.name || 'there').split(' ')[0];
  const rawQuote = {
    fullName: q.name,
    businessName: q.business || '',
    email: q.email,
    phone: q.phone || '',
    contactMethod: 'email',
    dateNeeded: q.deadline || '',
    delivery: 'pickup',
    zipCode: '',
    notes: q.message || '',
    garmentName: 'Custom screen printing',
    qty: q.quantity || '',
    printLocation: q.print_locations || '',
    inkColors: '',
    artworkStatus: '',
    estimatedTotal: '',
    fileUrl: q.artwork_url || '',
    fileName: q.artwork_filename || '',
  };
  const payload = {
    event: 'quote_submitted',
    source: '11rprint.com/homepage-quote',
    submittedAt: new Date().toISOString(),
    rawQuote,
    nexus: {
      intakeUrl: process.env.NEXUS_INSTANT_QUOTE_URL || 'https://nexus.11rprint.com/api/public/instant-quote',
      intakeSecret: process.env.NEXUS_INTAKE_SECRET || '',
    },
    customer: {
      fullName: q.name || '',
      firstName,
      businessName: q.business || '',
      email: q.email || '',
      phone: q.phone || '',
      preferredContactMethod: 'Email',
    },
    order: {
      garmentName: rawQuote.garmentName,
      quantity: q.quantity || '',
      printLocation: q.print_locations || '',
      inkColors: '',
      artworkStatus: '',
      estimatedTotal: '',
      dateNeeded: q.deadline || '',
      delivery: 'Local Pickup',
      zipCode: '',
      notes: q.message || '',
      fileName: q.artwork_filename || '',
      fileUrl: q.artwork_url || '',
    },
    emails: {
      from: '11R Print <orders@11rprint.com>',
      replyTo: 'orders@11rprint.com',
      internalTo: 'orders@11rprint.com',
      customerSubject: 'We received your quote request — 11R Print',
    },
  };
  try {
    const response = await fetch(n8nWebhookUrl, { method: 'POST', headers, body: JSON.stringify(payload) });
    if (!response.ok) console.error('n8n homepage quote webhook error:', response.status, await response.text());
    return response.ok;
  } catch (err) {
    console.error('n8n homepage quote webhook failed:', err);
    return false;
  }
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
    const { customer_name, customer_email, customer_phone, customer_company, customer_logo_url, mockup_urls, mockup_dimensions, pricing_items, deposit_amount, order_notes, policy_text } = body;
    if (!customer_name || !customer_email) return res(400, { error: 'Name and email required' });

    // Ensure mockup_urls is stored as a plain string array (text[] column)
    const cleanUrls = (mockup_urls || []).map(u => typeof u === 'string' ? u : (u && u.url) || '').filter(Boolean);

    const token = crypto.randomBytes(22).toString('hex');
    const { data, error } = await sb()
      .from('proofs')
      .insert([{
        token,
        customer_name,
        customer_email,
        customer_phone: customer_phone || null,
        customer_company: customer_company || null,
        customer_logo_url: customer_logo_url || null,
        mockup_urls: cleanUrls,
        mockup_dimensions: mockup_dimensions || [],
        pricing_items: pricing_items || [],
        deposit_amount: deposit_amount || null,
        order_notes: order_notes || null,
        policy_text: policy_text || '',
        status: 'pending'
      }])
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
      .select('token,customer_name,customer_phone,customer_company,customer_logo_url,mockup_urls,mockup_dimensions,pricing_items,deposit_amount,order_notes,policy_text,status,created_at,approved_at,approved_by_name')
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
      const resendHeaders = { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' };

      // Admin notification
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: resendHeaders,
        body: JSON.stringify({
          from: 'Orders <orders@11rprint.com>',
          to: 'orders@11rprint.com',
          subject: `New Custom Order — ${o.customer_name}`,
          text: `New mockup order from ${o.customer_name}\n\nProduct: ${o.product || '—'}\nColor: ${o.shirt_color || '—'}\nLocation: ${o.print_location || '—'}\nQuantity: ${o.quantity || '—'}\nContact: ${o.customer_email || ''} ${o.customer_phone || ''}\nEst. Total: ${estTotal}\n\nView full details + images in your admin dashboard:\nhttps://11rprint.com/admin/`
        })
      }).catch(() => {});

      // Customer confirmation email
      if (o.customer_email) {
        const sizesText = o.sizes && typeof o.sizes === 'object'
          ? Object.entries(o.sizes).filter(([,v]) => v > 0).map(([k,v]) => `${k.toUpperCase()}: ${v}`).join(', ') || '—'
          : '—';
        const customerHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:4px;overflow:hidden;max-width:600px;">

        <!-- Header -->
        <tr>
          <td style="padding:36px 36px 16px;text-align:center;">
            <a href="https://11rprint.com" style="text-decoration:none;">
              <img src="https://11rprint.com/images/11R%20VECTOR%20FINAL%20SVG.png" alt="11R Print" width="140" height="140" style="display:inline-block;border:none;" />
            </a>
          </td>
        </tr>

        <!-- Accent bar -->
        <tr>
          <td style="height:3px;background:linear-gradient(to right,#000000 40%,#1a7a1a 60%);font-size:0;line-height:0;">&nbsp;</td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 36px 24px;">
            <h1 style="margin:0 0 8px;font-size:22px;color:#000000;">Quote Received</h1>
            <p style="margin:0 0 24px;font-size:15px;color:#444444;line-height:1.6;">
              Hey ${o.customer_name}, thanks for reaching out! We've received your quote request and will follow up within <strong>1 business day</strong>.
            </p>

            <!-- Quote summary -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e0e0e0;border-radius:4px;margin-bottom:24px;">
              <tr>
                <td colspan="2" style="background:#f9f9f9;padding:12px 16px;font-size:11px;font-weight:bold;color:#666;letter-spacing:1px;text-transform:uppercase;border-bottom:1px solid #e0e0e0;">
                  Your Quote Summary
                </td>
              </tr>
              ${o.product ? `<tr><td style="padding:10px 16px;font-size:13px;color:#666;border-bottom:1px solid #f0f0f0;width:40%;">Product</td><td style="padding:10px 16px;font-size:13px;color:#000;border-bottom:1px solid #f0f0f0;font-weight:500;">${o.product}</td></tr>` : ''}
              ${o.shirt_color ? `<tr><td style="padding:10px 16px;font-size:13px;color:#666;border-bottom:1px solid #f0f0f0;">Color</td><td style="padding:10px 16px;font-size:13px;color:#000;border-bottom:1px solid #f0f0f0;font-weight:500;">${o.shirt_color}</td></tr>` : ''}
              ${o.print_location ? `<tr><td style="padding:10px 16px;font-size:13px;color:#666;border-bottom:1px solid #f0f0f0;">Print Location</td><td style="padding:10px 16px;font-size:13px;color:#000;border-bottom:1px solid #f0f0f0;font-weight:500;">${o.print_location}</td></tr>` : ''}
              ${o.quantity ? `<tr><td style="padding:10px 16px;font-size:13px;color:#666;border-bottom:1px solid #f0f0f0;">Quantity</td><td style="padding:10px 16px;font-size:13px;color:#000;border-bottom:1px solid #f0f0f0;font-weight:500;">${o.quantity}</td></tr>` : ''}
              ${sizesText !== '—' ? `<tr><td style="padding:10px 16px;font-size:13px;color:#666;border-bottom:1px solid #f0f0f0;">Sizes</td><td style="padding:10px 16px;font-size:13px;color:#000;border-bottom:1px solid #f0f0f0;font-weight:500;">${sizesText}</td></tr>` : ''}
              ${o.deadline ? `<tr><td style="padding:10px 16px;font-size:13px;color:#666;border-bottom:1px solid #f0f0f0;">Deadline</td><td style="padding:10px 16px;font-size:13px;color:#000;border-bottom:1px solid #f0f0f0;font-weight:500;">${o.deadline}</td></tr>` : ''}
              <tr>
                <td style="padding:12px 16px;font-size:14px;color:#000;font-weight:bold;">Estimate</td>
                <td style="padding:12px 16px;font-size:16px;color:#1a7a1a;font-weight:bold;">${estTotal}</td>
              </tr>
            </table>

            <p style="margin:0 0 8px;font-size:13px;color:#666;line-height:1.6;">
              This is an <strong>estimate only</strong>. Final pricing is confirmed after we review your artwork.
            </p>
            <p style="margin:0 0 32px;font-size:13px;color:#666;line-height:1.6;">
              Questions? Just reply to this email — we're happy to help.
            </p>

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#1a7a1a;border-radius:3px;">
                  <a href="https://11rprint.com" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;letter-spacing:0.5px;">
                    Visit 11rprint.com
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 36px;border-top:1px solid #eeeeee;">
            <p style="margin:0;font-size:12px;color:#999999;line-height:1.6;">
              11R Print &nbsp;|&nbsp; Built With Passion. Printed With Purpose.<br>
              <a href="https://11rprint.com" style="color:#1a7a1a;text-decoration:none;">11rprint.com</a>
              &nbsp;&nbsp;·&nbsp;&nbsp;
              <a href="https://instagram.com/11RPRINT" style="color:#1a7a1a;text-decoration:none;">@11RPRINT</a>
              &nbsp;&nbsp;·&nbsp;&nbsp;
              <a href="mailto:orders@11rprint.com" style="color:#1a7a1a;text-decoration:none;">orders@11rprint.com</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: resendHeaders,
          body: JSON.stringify({
            from: '11R Print <orders@11rprint.com>',
            to: o.customer_email,
            reply_to: 'orders@11rprint.com',
            subject: `Your Quote Request — 11R Print`,
            html: customerHtml
          })
        }).catch(() => {});
      }
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

  // POST /quotes — submit quote from homepage (PUBLIC)
  if (path === '/quotes' && method === 'POST') {
    const q = body;
    if (!q.name) return res(400, { error: 'Name required' });
    if (!q.email) return res(400, { error: 'Email required' });
    if (!q.message) return res(400, { error: 'Project details required' });

    const { data, error } = await sb()
      .from('quotes')
      .insert([{
        name: q.name,
        business: q.business || null,
        email: q.email,
        phone: q.phone || null,
        quantity: q.quantity || null,
        shirt_color: q.shirt_color || null,
        print_locations: q.print_locations || null,
        deadline: q.deadline || null,
        message: q.message,
        artwork_url: q.artwork_url || null,
        artwork_filename: q.artwork_filename || null
      }])
      .select()
      .single();
    if (error) return res(500, { error: error.message });

    const RESEND_KEY = process.env.RESEND_API_KEY;
    if (RESEND_KEY) {
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Orders <orders@11rprint.com>',
          to: 'orders@11rprint.com',
          subject: `New Quote Request — ${q.name}`,
          text: [
            `New quote request from ${q.name}`,
            q.business ? `Business: ${q.business}` : '',
            `Email: ${q.email}`,
            q.phone ? `Phone: ${q.phone}` : '',
            q.quantity ? `Quantity: ${q.quantity}` : '',
            q.shirt_color ? `Fabric: ${q.shirt_color}` : '',
            q.print_locations ? `Print Locations: ${q.print_locations}` : '',
            q.deadline ? `Deadline: ${q.deadline}` : '',
            `\nDetails:\n${q.message}`,
            q.artwork_url ? `\nArtwork File: ${q.artwork_url}` : ''
          ].filter(Boolean).join('\n')
        })
      }).catch(() => {});
    }

    const n8nSent = await forwardHomepageQuoteToN8n(q);

    const nexusSent = n8nSent || await forwardQuoteToNexus({
      ...q,
      customerName: q.name,
      customerCompany: q.business,
      customerEmail: q.email,
      customerPhone: q.phone,
      garmentStyle: 'Custom screen printing',
      garmentColor: q.shirt_color,
      printLocations: q.print_locations,
      dueDate: q.deadline,
      artworkUrl: q.artwork_url,
      fileName: q.artwork_filename,
    }, '11rprint.com homepage quote form');

    return res(200, { ok: true, n8nSent, nexusSent });
  }

  // GET /quotes — list quote requests (admin)
  if (path === '/quotes' && method === 'GET') {
    if (!auth(event.headers)) return res(401, { error: 'Unauthorized' });
    const { data, error } = await sb()
      .from('quotes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return res(500, { error: error.message });
    return res(200, { quotes: data });
  }

  // DELETE /quotes/:id (admin)
  const quoteDel = path.match(/^\/quotes\/([a-f0-9-]+)$/);
  if (quoteDel && method === 'DELETE') {
    if (!auth(event.headers)) return res(401, { error: 'Unauthorized' });
    const { error } = await sb().from('quotes').delete().eq('id', quoteDel[1]);
    if (error) return res(500, { error: error.message });
    return res(200, { ok: true });
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

  // ── CRM: CUSTOMERS ─────────────────────────────────────────────────────

  if (path === '/customers' && method === 'GET') {
    if (!auth(event.headers)) return res(401, { error: 'Unauthorized' });
    const qs = event.queryStringParameters || {};
    let query = sb().from('customers').select('*').order('created_at', { ascending: false });
    if (qs.q) {
      const q = qs.q.replace(/[%_]/g, '\\$&');
      query = query.or(`name.ilike.%${q}%,company.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
    }
    const { data, error } = await query;
    if (error) return res(500, { error: error.message });
    return res(200, { customers: data });
  }

  if (path === '/customers' && method === 'POST') {
    if (!auth(event.headers)) return res(401, { error: 'Unauthorized' });
    const { name, company, email, phone, billing_address, tax_exempt, notes, lead_source, preferred_contact } = body;
    if (!name) return res(400, { error: 'Name required' });
    const { data, error } = await sb().from('customers').insert([{
      name: name.trim(), company: company||null, email: email||null, phone: phone||null,
      billing_address: billing_address||null, tax_exempt: !!tax_exempt,
      notes: notes||null, lead_source: lead_source||null, preferred_contact: preferred_contact||'email'
    }]).select().single();
    if (error) return res(500, { error: error.message });
    const N8N = process.env.N8N_WEBHOOK_URL;
    if (N8N) fetch(N8N, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ event:'customer_created', customer: data }) }).catch(()=>{});
    return res(200, { customer: data });
  }

  const custMatch = path.match(/^\/customers\/([a-f0-9-]+)$/);
  if (custMatch && method === 'GET') {
    if (!auth(event.headers)) return res(401, { error: 'Unauthorized' });
    const { data, error } = await sb().from('customers').select('*').eq('id', custMatch[1]).single();
    if (error || !data) return res(404, { error: 'Customer not found' });
    const [jr, ir, rr] = await Promise.all([
      sb().from('jobs').select('*').eq('customer_id', custMatch[1]).order('created_at', { ascending: false }),
      sb().from('invoices').select('*').eq('customer_id', custMatch[1]).order('created_at', { ascending: false }),
      sb().from('receipts').select('*').eq('customer_id', custMatch[1]).order('created_at', { ascending: false })
    ]);
    return res(200, { customer: data, jobs: jr.data||[], invoices: ir.data||[], receipts: rr.data||[] });
  }

  if (custMatch && method === 'PUT') {
    if (!auth(event.headers)) return res(401, { error: 'Unauthorized' });
    const allowed = ['name','company','email','phone','billing_address','tax_exempt','notes','lead_source','preferred_contact'];
    const update = { updated_at: new Date().toISOString() };
    allowed.forEach(k => { if (body[k] !== undefined) update[k] = body[k]; });
    const { data, error } = await sb().from('customers').update(update).eq('id', custMatch[1]).select().single();
    if (error) return res(500, { error: error.message });
    return res(200, { customer: data });
  }

  if (custMatch && method === 'DELETE') {
    if (!auth(event.headers)) return res(401, { error: 'Unauthorized' });
    const { error } = await sb().from('customers').delete().eq('id', custMatch[1]);
    if (error) return res(500, { error: error.message });
    return res(200, { ok: true });
  }

  // ── JOBS ────────────────────────────────────────────────────────────────

  if (path === '/jobs' && method === 'GET') {
    if (!auth(event.headers)) return res(401, { error: 'Unauthorized' });
    const qs = event.queryStringParameters || {};
    let q = sb().from('jobs').select('*,customers(name,company,email)').order('created_at', { ascending: false });
    if (qs.status) q = q.eq('status', qs.status);
    if (qs.customer_id) q = q.eq('customer_id', qs.customer_id);
    const { data, error } = await q;
    if (error) return res(500, { error: error.message });
    return res(200, { jobs: data });
  }

  if (path === '/jobs' && method === 'POST') {
    if (!auth(event.headers)) return res(401, { error: 'Unauthorized' });
    const { customer_id, title, due_date, garment_style, garment_color, quantity, sizes, print_locations, ink_colors, notes, internal_notes } = body;
    if (!customer_id || !title) return res(400, { error: 'customer_id and title required' });
    const { count: jc } = await sb().from('jobs').select('*', { count: 'exact', head: true });
    const job_number = `JOB-${new Date().getFullYear()}-${String((jc||0)+1).padStart(4,'0')}`;
    const jobRow = {
      customer_id, job_number, title, status: 'new',
      due_date: due_date||null, garment_style: garment_style||null, garment_color: garment_color||null,
      quantity: quantity||null, print_locations: print_locations||[],
      ink_colors: ink_colors||null, notes: notes||null, internal_notes: internal_notes||null
    };
    if (sizes !== undefined) jobRow.sizes = sizes;
    const { data, error } = await sb().from('jobs').insert([jobRow]).select().single();
    if (error) return res(500, { error: error.message });
    return res(200, { job: data });
  }

  const jobMatch = path.match(/^\/jobs\/([a-f0-9-]+)$/);
  if (jobMatch && method === 'GET') {
    if (!auth(event.headers)) return res(401, { error: 'Unauthorized' });
    const { data, error } = await sb().from('jobs').select('*,customers(name,company,email,phone)').eq('id', jobMatch[1]).single();
    if (error || !data) return res(404, { error: 'Job not found' });
    return res(200, { job: data });
  }

  if (jobMatch && method === 'PUT') {
    if (!auth(event.headers)) return res(401, { error: 'Unauthorized' });
    const allowed = ['title','status','due_date','garment_style','garment_color','quantity','sizes','print_locations','ink_colors','notes','internal_notes','artwork_url'];
    const update = { updated_at: new Date().toISOString() };
    allowed.forEach(k => { if (body[k] !== undefined) update[k] = body[k]; });
    const { data, error } = await sb().from('jobs').update(update).eq('id', jobMatch[1]).select().single();
    if (error) return res(500, { error: error.message });
    return res(200, { job: data });
  }

  if (jobMatch && method === 'DELETE') {
    if (!auth(event.headers)) return res(401, { error: 'Unauthorized' });
    const { error } = await sb().from('jobs').delete().eq('id', jobMatch[1]);
    if (error) return res(500, { error: error.message });
    return res(200, { ok: true });
  }

  // ── INVOICES ─────────────────────────────────────────────────────────────

  if (path === '/invoices' && method === 'GET') {
    if (!auth(event.headers)) return res(401, { error: 'Unauthorized' });
    const qs = event.queryStringParameters || {};
    let q = sb().from('invoices').select('*,customers(name,company,email)').order('created_at', { ascending: false });
    if (qs.status) q = q.eq('status', qs.status);
    if (qs.customer_id) q = q.eq('customer_id', qs.customer_id);
    const { data, error } = await q;
    if (error) return res(500, { error: error.message });
    return res(200, { invoices: data });
  }

  if (path === '/invoices' && method === 'POST') {
    if (!auth(event.headers)) return res(401, { error: 'Unauthorized' });
    const { customer_id, job_id, items, tax_rate, deposit_type, deposit_value, due_date, terms, notes, internal_notes } = body;
    if (!customer_id) return res(400, { error: 'customer_id required' });
    const { count: ic } = await sb().from('invoices').select('*', { count: 'exact', head: true });
    const invoice_number = `INV-${new Date().getFullYear()}-${String((ic||0)+1).padStart(4,'0')}`;
    const lineItems = items || [];
    const subtotal = lineItems.reduce((s, i) => s + (parseFloat(i.quantity)||1) * (parseFloat(i.unit_price)||0), 0);
    const taxRate = parseFloat(tax_rate) || 0;
    const taxAmount = subtotal * taxRate;
    const total = subtotal + taxAmount;
    const depType = deposit_type || 'percent';
    const depVal = parseFloat(deposit_value) || 50;
    const depositRequired = depType === 'percent' ? total * (depVal / 100) : depVal;
    const { data: inv, error: invErr } = await sb().from('invoices').insert([{
      invoice_number, customer_id, job_id: job_id||null, status: 'draft',
      subtotal: parseFloat(subtotal.toFixed(2)), tax_rate: taxRate,
      tax_amount: parseFloat(taxAmount.toFixed(2)), total: parseFloat(total.toFixed(2)),
      deposit_type: depType, deposit_value: depVal,
      deposit_required: parseFloat(depositRequired.toFixed(2)),
      amount_paid: 0, balance_due: parseFloat(total.toFixed(2)),
      due_date: due_date||null, terms: terms||null, notes: notes||null, internal_notes: internal_notes||null
    }]).select().single();
    if (invErr) return res(500, { error: invErr.message });
    if (lineItems.length > 0) {
      const rows = lineItems.map((item, idx) => ({
        invoice_id: inv.id,
        description: item.description||'',
        quantity: parseFloat(item.quantity)||1,
        unit_price: parseFloat(item.unit_price)||0,
        amount: parseFloat(((parseFloat(item.quantity)||1)*(parseFloat(item.unit_price)||0)).toFixed(2)),
        sort_order: idx
      }));
      await sb().from('invoice_items').insert(rows);
    }
    return res(200, { invoice: inv });
  }

  const invMatch = path.match(/^\/invoices\/([a-f0-9-]+)$/);
  if (invMatch && method === 'GET') {
    // public — invoice UUID is unguessable; customers access via email link
    const { data: inv, error } = await sb().from('invoices').select('*,customers(name,company,email,phone,billing_address)').eq('id', invMatch[1]).single();
    if (error || !inv) return res(404, { error: 'Invoice not found' });
    const [ir, pr] = await Promise.all([
      sb().from('invoice_items').select('*').eq('invoice_id', invMatch[1]).order('sort_order'),
      sb().from('payments').select('*').eq('invoice_id', invMatch[1]).order('paid_at')
    ]);
    return res(200, { invoice: inv, items: ir.data||[], payments: pr.data||[] });
  }

  if (invMatch && method === 'PUT') {
    if (!auth(event.headers)) return res(401, { error: 'Unauthorized' });
    const allowed = ['status','due_date','terms','notes','internal_notes','deposit_type','deposit_value'];
    const update = { updated_at: new Date().toISOString() };
    allowed.forEach(k => { if (body[k] !== undefined) update[k] = body[k]; });
    if (update.deposit_type !== undefined || update.deposit_value !== undefined) {
      const { data: cur } = await sb().from('invoices').select('total,deposit_type,deposit_value').eq('id', invMatch[1]).single();
      if (cur) {
        const dt = update.deposit_type || cur.deposit_type;
        const dv = parseFloat(update.deposit_value !== undefined ? update.deposit_value : cur.deposit_value);
        update.deposit_required = dt === 'percent' ? parseFloat((cur.total*(dv/100)).toFixed(2)) : dv;
      }
    }
    const { data: inv, error } = await sb().from('invoices').update(update).eq('id', invMatch[1]).select('*,customers(name,company,email)').single();
    if (error) return res(500, { error: error.message });
    if (body.status === 'sent' && inv.customers?.email) {
      const RESEND_KEY = process.env.RESEND_API_KEY;
      if (RESEND_KEY) {
        const portalLink = `https://11rprint.com/admin/invoice-print.html?id=${invMatch[1]}`;
        const emailHtml = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f9f9f9;">
<div style="background:#050706;padding:24px 28px;border-radius:12px 12px 0 0;"><img src="https://11rprint.com/images/11r-logo-new.png" alt="11R Print" style="height:36px;"/></div>
<div style="background:#fff;padding:32px 28px;border-radius:0 0 12px 12px;">
<h2 style="margin:0 0 8px;font-size:22px;color:#050706;">Invoice ${inv.invoice_number}</h2>
<p style="color:#555;font-size:14px;margin:0 0 24px;">Hi ${inv.customers.name}, here is your invoice from 11R Print.</p>
<table style="width:100%;border-collapse:collapse;margin-bottom:24px;background:#f9f9f9;border-radius:8px;">
<tr><td style="padding:10px 16px;font-size:12px;color:#888;width:150px;">Invoice #</td><td style="padding:10px 16px;font-size:14px;font-weight:bold;">${inv.invoice_number}</td></tr>
<tr><td style="padding:10px 16px;font-size:12px;color:#888;border-top:1px solid #eee;">Total</td><td style="padding:10px 16px;font-size:18px;font-weight:bold;color:#058f45;border-top:1px solid #eee;">$${parseFloat(inv.total).toFixed(2)}</td></tr>
<tr><td style="padding:10px 16px;font-size:12px;color:#888;border-top:1px solid #eee;">Deposit Due</td><td style="padding:10px 16px;font-size:14px;font-weight:bold;border-top:1px solid #eee;">$${parseFloat(inv.deposit_required).toFixed(2)}</td></tr>
${inv.due_date?`<tr><td style="padding:10px 16px;font-size:12px;color:#888;border-top:1px solid #eee;">Due Date</td><td style="padding:10px 16px;font-size:13px;border-top:1px solid #eee;">${inv.due_date}</td></tr>`:''}
</table>
${inv.notes?`<p style="background:#f5f5f5;padding:14px;border-radius:8px;font-size:13px;color:#555;">${inv.notes}</p>`:''}
<a href="${portalLink}" style="display:inline-block;margin-top:24px;background:#058f45;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;">View Invoice</a>
<p style="margin-top:32px;font-size:12px;color:#999;">Questions? Email <a href="mailto:orders@11rprint.com" style="color:#058f45;">orders@11rprint.com</a></p>
</div></body></html>`;
        fetch('https://api.resend.com/emails', { method:'POST', headers:{'Authorization':`Bearer ${RESEND_KEY}`,'Content-Type':'application/json'}, body: JSON.stringify({ from:'11R Print <orders@11rprint.com>', to: inv.customers.email, subject:`Invoice ${inv.invoice_number} from 11R Print`, html: emailHtml }) }).catch(()=>{});
      }
      const N8N = process.env.N8N_WEBHOOK_URL;
      if (N8N) fetch(N8N, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ event:'invoice_sent', invoice_id: invMatch[1], invoice_number: inv.invoice_number }) }).catch(()=>{});
    }
    return res(200, { invoice: inv });
  }

  if (invMatch && method === 'DELETE') {
    if (!auth(event.headers)) return res(401, { error: 'Unauthorized' });
    const { error } = await sb().from('invoices').update({ status:'void', updated_at: new Date().toISOString() }).eq('id', invMatch[1]);
    if (error) return res(500, { error: error.message });
    return res(200, { ok: true });
  }

  // POST /invoices/:id/items — add line item
  const invItemsMatch = path.match(/^\/invoices\/([a-f0-9-]+)\/items$/);
  if (invItemsMatch && method === 'POST') {
    if (!auth(event.headers)) return res(401, { error: 'Unauthorized' });
    const qty = parseFloat(body.quantity)||1;
    const price = parseFloat(body.unit_price)||0;
    const { data: item, error } = await sb().from('invoice_items').insert([{
      invoice_id: invItemsMatch[1], description: body.description||'',
      quantity: qty, unit_price: price, amount: parseFloat((qty*price).toFixed(2)), sort_order: 99
    }]).select().single();
    if (error) return res(500, { error: error.message });
    await recalcInvoice(sb(), invItemsMatch[1]);
    const { data: inv } = await sb().from('invoices').select('subtotal,tax_amount,total,deposit_required,balance_due').eq('id', invItemsMatch[1]).single();
    return res(200, { item, invoice: inv });
  }

  // DELETE /invoice-items/:id
  const invItemDel = path.match(/^\/invoice-items\/([a-f0-9-]+)$/);
  if (invItemDel && method === 'DELETE') {
    if (!auth(event.headers)) return res(401, { error: 'Unauthorized' });
    const { data: item } = await sb().from('invoice_items').select('invoice_id').eq('id', invItemDel[1]).single();
    const { error } = await sb().from('invoice_items').delete().eq('id', invItemDel[1]);
    if (error) return res(500, { error: error.message });
    if (item?.invoice_id) await recalcInvoice(sb(), item.invoice_id);
    return res(200, { ok: true });
  }

  // ── PAYMENTS ──────────────────────────────────────────────────────────────

  const payMatch = path.match(/^\/invoices\/([a-f0-9-]+)\/payments$/);
  if (payMatch && method === 'POST') {
    if (!auth(event.headers)) return res(401, { error: 'Unauthorized' });
    const payAmount = parseFloat(body.amount);
    if (!payAmount || payAmount <= 0) return res(400, { error: 'Valid amount required' });
    const { data: inv } = await sb().from('invoices').select('*,customers(name,company,email,phone,billing_address)').eq('id', payMatch[1]).single();
    if (!inv) return res(404, { error: 'Invoice not found' });
    if (payAmount > inv.balance_due + 0.01) return res(400, { error: 'Payment exceeds balance due' });
    const { count: pc } = await sb().from('payments').select('*', { count: 'exact', head: true });
    const yr = new Date().getFullYear();
    const payment_number = `PAY-${yr}-${String((pc||0)+1).padStart(4,'0')}`;
    const { data: payment, error: pErr } = await sb().from('payments').insert([{
      payment_number, invoice_id: inv.id, customer_id: inv.customer_id,
      amount: payAmount, method: body.method||'cash', reference: body.reference||null,
      paid_at: body.paid_at||new Date().toISOString(),
      payment_type: body.payment_type||'deposit', notes: body.notes||null
    }]).select().single();
    if (pErr) return res(500, { error: pErr.message });
    const newPaid = parseFloat((inv.amount_paid + payAmount).toFixed(2));
    const newBal = parseFloat(Math.max(0, inv.total - newPaid).toFixed(2));
    let newStatus = newBal <= 0 ? 'paid' : newPaid >= inv.deposit_required ? 'deposit_paid' : 'partially_paid';
    await sb().from('invoices').update({ amount_paid: newPaid, balance_due: newBal, status: newStatus, updated_at: new Date().toISOString() }).eq('id', inv.id);
    const { count: rc } = await sb().from('receipts').select('*', { count: 'exact', head: true });
    const receipt_number = `RCT-${yr}-${String((rc||0)+1).padStart(4,'0')}`;
    const snapshot = {
      receipt_number, payment_number, invoice_number: inv.invoice_number,
      issued_at: new Date().toISOString(),
      customer: { name: inv.customers?.name||'', company: inv.customers?.company||'', email: inv.customers?.email||'', phone: inv.customers?.phone||'', billing_address: inv.customers?.billing_address||'' },
      payment: { amount: payAmount, method: body.method||'cash', reference: body.reference||'', paid_at: body.paid_at||new Date().toISOString(), payment_type: body.payment_type||'deposit' },
      invoice: { total: inv.total, prior_paid: inv.amount_paid, this_payment: payAmount, new_balance: newBal },
      status: newBal <= 0 ? 'PAID IN FULL' : newPaid >= inv.deposit_required ? 'DEPOSIT PAID' : 'PARTIALLY PAID'
    };
    const { data: receipt } = await sb().from('receipts').insert([{ receipt_number, payment_id: payment.id, invoice_id: inv.id, customer_id: inv.customer_id, snapshot }]).select().single();
    if (receipt) await sb().from('payments').update({ receipt_id: receipt.id }).eq('id', payment.id);
    const RESEND_KEY = process.env.RESEND_API_KEY;
    if (RESEND_KEY && inv.customers?.email) {
      const printUrl = `https://11rprint.com/admin/receipt-print.html?id=${receipt?.id}`;
      fetch('https://api.resend.com/emails', { method:'POST', headers:{'Authorization':`Bearer ${RESEND_KEY}`,'Content-Type':'application/json'}, body: JSON.stringify({ from:'11R Print <orders@11rprint.com>', to: inv.customers.email, subject:`Receipt ${receipt_number} — 11R Print`, html: buildReceiptEmail(snapshot, printUrl) }) }).catch(()=>{});
      await sb().from('receipts').update({ emailed_at: new Date().toISOString() }).eq('id', receipt?.id);
    }
    const N8N = process.env.N8N_WEBHOOK_URL;
    if (N8N) fetch(N8N, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ event:'payment_received', payment_number, invoice_id: inv.id, amount: payAmount, new_status: newStatus }) }).catch(()=>{});
    return res(200, { payment, receipt, new_status: newStatus, balance_due: newBal });
  }

  // ── RECEIPTS ─────────────────────────────────────────────────────────────

  // GET /receipts?customer_id=... — list receipts for a customer (admin)
  if (path === '/receipts' && method === 'GET') {
    if (!auth(event.headers)) return res(401, { error: 'Unauthorized' });
    const rcptQs = event.queryStringParameters || {};
    let q = sb().from('receipts').select('*').order('created_at', { ascending: false });
    if (rcptQs.customer_id) q = q.eq('customer_id', rcptQs.customer_id);
    const { data, error } = await q;
    if (error) return res(500, { error: error.message });
    return res(200, { receipts: data || [] });
  }

  const rcptMatch = path.match(/^\/receipts\/([a-f0-9-]+)$/);
  if (rcptMatch && method === 'GET') {
    if (!auth(event.headers)) return res(401, { error: 'Unauthorized' });
    const { data, error } = await sb().from('receipts').select('*').eq('id', rcptMatch[1]).single();
    if (error || !data) return res(404, { error: 'Receipt not found' });
    return res(200, { receipt: data });
  }

  const rcptPub = path.match(/^\/receipts\/([a-f0-9-]+)\/public$/);
  if (rcptPub && method === 'GET') {
    const { data, error } = await sb().from('receipts').select('receipt_number,snapshot,created_at').eq('id', rcptPub[1]).single();
    if (error || !data) return res(404, { error: 'Receipt not found' });
    return res(200, { receipt: data });
  }

  if (rcptMatch && method === 'DELETE') {
    if (!auth(event.headers)) return res(401, { error: 'Unauthorized' });
    const { error } = await sb().from('receipts').delete().eq('id', rcptMatch[1]);
    if (error) return res(500, { error: error.message });
    return res(200, { ok: true });
  }

  // ── SEND EMAIL (generic CRM template emails) ──────────────────────────────

  if (path === '/send-email' && method === 'POST') {
    if (!auth(event.headers)) return res(401, { error: 'Unauthorized' });
    const { to, subject, text, html } = body;
    if (!to || !subject) return res(400, { error: 'to and subject required' });
    const RESEND_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_KEY) return res(500, { error: 'Email not configured' });
    const emailHtml = html || `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f9f9f9;">
<div style="background:#050706;padding:20px 24px;border-radius:10px 10px 0 0;"><img src="https://11rprint.com/images/11r-logo-new.png" alt="11R Print" style="height:32px;"/></div>
<div style="background:#fff;padding:28px 24px;border-radius:0 0 10px 10px;white-space:pre-line;font-size:14px;color:#333;line-height:1.7;">${(text||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
<p style="text-align:center;font-size:11px;color:#aaa;margin-top:16px;">11R Print · <a href="https://11rprint.com" style="color:#058f45;">11rprint.com</a></p>
</body></html>`;
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Orders@11rprint.com', to, subject, html: emailHtml, text: text||'' })
    });
    const emailData = await emailRes.json();
    if (!emailRes.ok) return res(500, { error: emailData.message || 'Email failed' });
    return res(200, { ok: true, id: emailData.id });
  }

  // ── CUSTOMER ARTWORK ──────────────────────────────────────────────────────

  const artUploadMatch = path.match(/^\/customers\/([a-f0-9-]+)\/artwork-url$/);
  if (artUploadMatch && method === 'POST') {
    if (!auth(event.headers)) return res(401, { error: 'Unauthorized' });
    const { filename } = body;
    if (!filename) return res(400, { error: 'filename required' });
    const ext = filename.split('.').pop().toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'ai', 'eps', 'svg', 'psd', 'zip'].includes(ext))
      return res(400, { error: 'File type not allowed' });
    const key = `customer-artwork/${artUploadMatch[1]}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
    const { data, error } = await sb().storage.from('proof-mockups').createSignedUploadUrl(key);
    if (error) return res(500, { error: error.message });
    const { data: { publicUrl } } = sb().storage.from('proof-mockups').getPublicUrl(key);
    return res(200, { signedUrl: data.signedUrl, token: data.token, publicUrl, key });
  }

  const artListMatch = path.match(/^\/customers\/([a-f0-9-]+)\/artwork$/);
  if (artListMatch && method === 'GET') {
    if (!auth(event.headers)) return res(401, { error: 'Unauthorized' });
    const prefix = `customer-artwork/${artListMatch[1]}/`;
    const { data, error } = await sb().storage.from('proof-mockups').list(prefix.slice(0, -1), { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });
    if (error) return res(500, { error: error.message });
    const files = (data || []).filter(f => f.name !== '.emptyFolderPlaceholder').map(f => {
      const { data: { publicUrl } } = sb().storage.from('proof-mockups').getPublicUrl(`${prefix}${f.name}`);
      return { name: f.name, key: `${prefix}${f.name}`, publicUrl, created_at: f.created_at, size: f.metadata?.size };
    });
    return res(200, { files });
  }

  const artDelMatch = path.match(/^\/customers\/([a-f0-9-]+)\/artwork$/);
  if (artDelMatch && method === 'DELETE') {
    if (!auth(event.headers)) return res(401, { error: 'Unauthorized' });
    const { key } = body;
    if (!key) return res(400, { error: 'key required' });
    if (!key.startsWith(`customer-artwork/${artDelMatch[1]}/`)) return res(403, { error: 'Forbidden' });
    const { error } = await sb().storage.from('proof-mockups').remove([key]);
    if (error) return res(500, { error: error.message });
    return res(200, { ok: true });
  }

  // ── DASHBOARD STATS ────────────────────────────────────────────────────────

  if (path === '/dashboard' && method === 'GET') {
    if (!auth(event.headers)) return res(401, { error: 'Unauthorized' });
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const [cc, jc, ib, pm] = await Promise.all([
      sb().from('customers').select('*', { count:'exact', head:true }),
      sb().from('jobs').select('*', { count:'exact', head:true }).not('status','eq','complete'),
      sb().from('invoices').select('balance_due').not('status','in','("paid","void")'),
      sb().from('payments').select('amount').gte('paid_at', monthStart)
    ]);
    const outstanding = (ib.data||[]).reduce((s, i) => s + parseFloat(i.balance_due||0), 0);
    const monthRev = (pm.data||[]).reduce((s, p) => s + parseFloat(p.amount||0), 0);
    return res(200, { customers: cc.count||0, open_jobs: jc.count||0, outstanding: outstanding.toFixed(2), month_revenue: monthRev.toFixed(2) });
  }

  return res(404, { error: 'Not found' });
};
