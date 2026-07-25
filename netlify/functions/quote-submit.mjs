export const handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'Method not allowed' }) };

  let d;
  try { d = JSON.parse(event.body || '{}'); } catch {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const artworkLabels = {
    vector:    'Print-Ready Vector File (No Additional Charge)',
    hires:     'High-Resolution Image (Subject to Review)',
    vectorize: 'Artwork Needs Vectorization (+$25)',
    newdesign: 'I Need a New Design (Custom Quote Required)',
  };

  const contactLabel = { text: 'Text', email: 'Email', call: 'Phone Call' };

  const fileSection = d.fileUrl
    ? `<tr><td style="padding:8px 0;color:#666;font-size:13px;">Artwork File</td><td style="padding:8px 0;font-size:13px;"><a href="${d.fileUrl}">${d.fileName || 'Download'}</a></td></tr>`
    : '';

  const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
  <div style="background:#111;padding:24px 28px;">
    <img src="https://11rprint.com/images/11r-logo-new.png" alt="11R Print" style="height:36px;" />
  </div>
  <div style="padding:28px;">
    <h2 style="margin:0 0 4px;font-size:20px;">New Quote Request</h2>
    <p style="margin:0 0 24px;color:#666;font-size:13px;">Submitted via 11rprint.com/custom-order.html</p>

    <h3 style="margin:0 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:.05em;color:#333;">Contact</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr><td style="padding:8px 0;color:#666;font-size:13px;width:160px;">Name</td><td style="padding:8px 0;font-size:13px;">${d.fullName || '—'}</td></tr>
      <tr><td style="padding:8px 0;color:#666;font-size:13px;">Business</td><td style="padding:8px 0;font-size:13px;">${d.businessName || '—'}</td></tr>
      <tr><td style="padding:8px 0;color:#666;font-size:13px;">Email</td><td style="padding:8px 0;font-size:13px;"><a href="mailto:${d.email}">${d.email || '—'}</a></td></tr>
      <tr><td style="padding:8px 0;color:#666;font-size:13px;">Phone</td><td style="padding:8px 0;font-size:13px;">${d.phone || '—'}</td></tr>
      <tr><td style="padding:8px 0;color:#666;font-size:13px;">Preferred Contact</td><td style="padding:8px 0;font-size:13px;">${contactLabel[d.contactMethod] || d.contactMethod || '—'}</td></tr>
    </table>

    <h3 style="margin:0 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:.05em;color:#333;">Order Details</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr><td style="padding:8px 0;color:#666;font-size:13px;width:160px;">Garment</td><td style="padding:8px 0;font-size:13px;">${d.garmentName || '—'}</td></tr>
      <tr><td style="padding:8px 0;color:#666;font-size:13px;">Quantity</td><td style="padding:8px 0;font-size:13px;">${d.qty || '—'}</td></tr>
      <tr><td style="padding:8px 0;color:#666;font-size:13px;">Print Location</td><td style="padding:8px 0;font-size:13px;">${d.printLocation || '—'}</td></tr>
      <tr><td style="padding:8px 0;color:#666;font-size:13px;">Ink Colors</td><td style="padding:8px 0;font-size:13px;">${d.inkColors || '—'}</td></tr>
      <tr><td style="padding:8px 0;color:#666;font-size:13px;">Artwork Status</td><td style="padding:8px 0;font-size:13px;">${artworkLabels[d.artworkStatus] || d.artworkStatus || '—'}</td></tr>
      ${fileSection}
      <tr><td style="padding:8px 0;color:#666;font-size:13px;">Estimated Total</td><td style="padding:8px 0;font-size:13px;font-weight:bold;">${d.estimatedTotal || '—'}</td></tr>
    </table>

    <h3 style="margin:0 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:.05em;color:#333;">Delivery</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr><td style="padding:8px 0;color:#666;font-size:13px;width:160px;">Date Needed</td><td style="padding:8px 0;font-size:13px;">${d.dateNeeded || '—'}</td></tr>
      <tr><td style="padding:8px 0;color:#666;font-size:13px;">Delivery Method</td><td style="padding:8px 0;font-size:13px;">${d.delivery === 'shipping' ? 'Shipping' : 'Local Pickup'}</td></tr>
      ${d.delivery === 'shipping' && d.zipCode ? `<tr><td style="padding:8px 0;color:#666;font-size:13px;">ZIP Code</td><td style="padding:8px 0;font-size:13px;">${d.zipCode}</td></tr>` : ''}
    </table>

    ${d.notes ? `<h3 style="margin:0 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:.05em;color:#333;">Additional Notes</h3><p style="font-size:13px;color:#333;margin:0 0 24px;">${d.notes}</p>` : ''}

    <div style="background:#f5f5f5;border-radius:6px;padding:14px 16px;">
      <p style="margin:0;font-size:12px;color:#888;">Customer confirmed: This is an estimated quote. Final pricing is confirmed after 11R Print reviews the artwork and order requirements.</p>
    </div>
  </div>
</div>`;

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Orders <orders@11rprint.com>',
      to: ['Orders@11rprint.com'],
      reply_to: d.email || undefined,
      subject: `New Quote Request — ${d.fullName || 'Customer'} · ${d.qty || '?'} ${d.garmentName || 'units'}`,
      html,
    }),
  });

  if (!resendRes.ok) {
    const err = await resendRes.text();
    console.error('Resend error:', err);
    return { statusCode: 502, headers: cors, body: JSON.stringify({ error: 'Email failed', detail: err }) };
  }

  return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true }) };
};
