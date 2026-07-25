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
    ? `<tr><td style="padding:8px 0;color:#888;font-size:13px;">Artwork File</td><td style="padding:8px 0;font-size:13px;"><a href="${d.fileUrl}" style="color:#20ff7b;">${d.fileName || 'Download'}</a></td></tr>`
    : '';

  // ── Internal notification email (to Eleven) ───────────────────────────────
  const internalHtml = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #222;border-radius:10px;overflow:hidden;background:#0d0f0e;">
  <div style="background:#050706;padding:22px 28px;border-bottom:1px solid #1a1a1a;">
    <img src="https://11rprint.com/images/11r-logo-new.png" alt="11R Print" style="height:32px;" />
  </div>
  <div style="padding:28px;color:#dce7df;">
    <h2 style="margin:0 0 4px;font-size:20px;color:#f5f7f4;">New Quote Request</h2>
    <p style="margin:0 0 24px;color:#7a8a7e;font-size:13px;">Submitted via 11rprint.com — ${new Date().toLocaleString('en-US',{timeZone:'America/New_York'})}</p>

    <p style="margin:0 0 8px;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:#20ff7b;">Contact</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr><td style="padding:7px 0;color:#7a8a7e;font-size:13px;width:160px;">Name</td><td style="padding:7px 0;font-size:13px;color:#f5f7f4;">${d.fullName || '—'}</td></tr>
      <tr><td style="padding:7px 0;color:#7a8a7e;font-size:13px;">Business</td><td style="padding:7px 0;font-size:13px;color:#f5f7f4;">${d.businessName || '—'}</td></tr>
      <tr><td style="padding:7px 0;color:#7a8a7e;font-size:13px;">Email</td><td style="padding:7px 0;font-size:13px;"><a href="mailto:${d.email}" style="color:#20ff7b;">${d.email || '—'}</a></td></tr>
      <tr><td style="padding:7px 0;color:#7a8a7e;font-size:13px;">Phone</td><td style="padding:7px 0;font-size:13px;color:#f5f7f4;">${d.phone || '—'}</td></tr>
      <tr><td style="padding:7px 0;color:#7a8a7e;font-size:13px;">Preferred Contact</td><td style="padding:7px 0;font-size:13px;color:#f5f7f4;">${contactLabel[d.contactMethod] || d.contactMethod || '—'}</td></tr>
    </table>

    <p style="margin:0 0 8px;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:#20ff7b;">Order</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr><td style="padding:7px 0;color:#7a8a7e;font-size:13px;width:160px;">Garment</td><td style="padding:7px 0;font-size:13px;color:#f5f7f4;">${d.garmentName || '—'}</td></tr>
      <tr><td style="padding:7px 0;color:#7a8a7e;font-size:13px;">Quantity</td><td style="padding:7px 0;font-size:13px;color:#f5f7f4;">${d.qty || '—'}</td></tr>
      <tr><td style="padding:7px 0;color:#7a8a7e;font-size:13px;">Print Location</td><td style="padding:7px 0;font-size:13px;color:#f5f7f4;">${d.printLocation || '—'}</td></tr>
      <tr><td style="padding:7px 0;color:#7a8a7e;font-size:13px;">Ink Colors</td><td style="padding:7px 0;font-size:13px;color:#f5f7f4;">${d.inkColors || '—'}</td></tr>
      <tr><td style="padding:7px 0;color:#7a8a7e;font-size:13px;">Artwork</td><td style="padding:7px 0;font-size:13px;color:#f5f7f4;">${artworkLabels[d.artworkStatus] || d.artworkStatus || '—'}</td></tr>
      ${fileSection}
      <tr><td style="padding:7px 0;color:#7a8a7e;font-size:13px;">Est. Total</td><td style="padding:7px 0;font-size:14px;font-weight:900;color:#20ff7b;">${d.estimatedTotal || '—'}</td></tr>
    </table>

    <p style="margin:0 0 8px;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:#20ff7b;">Delivery</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr><td style="padding:7px 0;color:#7a8a7e;font-size:13px;width:160px;">Date Needed</td><td style="padding:7px 0;font-size:13px;color:#f5f7f4;">${d.dateNeeded || '—'}</td></tr>
      <tr><td style="padding:7px 0;color:#7a8a7e;font-size:13px;">Method</td><td style="padding:7px 0;font-size:13px;color:#f5f7f4;">${d.delivery === 'shipping' ? 'Shipping' : 'Local Pickup'}</td></tr>
      ${d.delivery === 'shipping' && d.zipCode ? `<tr><td style="padding:7px 0;color:#7a8a7e;font-size:13px;">ZIP</td><td style="padding:7px 0;font-size:13px;color:#f5f7f4;">${d.zipCode}</td></tr>` : ''}
    </table>

    ${d.notes ? `<p style="margin:0 0 8px;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:#20ff7b;">Notes</p><p style="font-size:13px;color:#dce7df;margin:0 0 24px;">${d.notes}</p>` : ''}
  </div>
</div>`;

  // ── Customer confirmation email ────────────────────────────────────────────
  const firstName = (d.fullName || 'there').split(' ')[0];
  const customerHtml = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#050706;border-radius:10px;overflow:hidden;">

  <!-- Header -->
  <div style="background:#050706;padding:28px 32px 22px;border-bottom:1px solid #1a1a1a;">
    <img src="https://11rprint.com/images/11r-logo-new.png" alt="11R Print" style="height:34px;display:block;" />
  </div>

  <!-- Hero -->
  <div style="padding:36px 32px 28px;background:#0d0f0e;">
    <p style="margin:0 0 6px;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.14em;color:#20ff7b;">Quote Request Received</p>
    <h1 style="margin:0 0 14px;font-size:28px;font-weight:900;color:#f5f7f4;letter-spacing:-.02em;line-height:1.15;">We've got your<br>request, ${firstName}.</h1>
    <p style="margin:0;font-size:15px;color:#7a8a7e;line-height:1.6;">Your quote request has been received and is currently under review. We'll reach out shortly to confirm pricing and next steps.</p>
  </div>

  <!-- Divider -->
  <div style="height:1px;background:linear-gradient(90deg,#20ff7b22,#20ff7b55,#20ff7b22);margin:0 32px;"></div>

  <!-- Order summary -->
  <div style="padding:28px 32px;background:#0d0f0e;">
    <p style="margin:0 0 16px;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.14em;color:#20ff7b;">Your Order Summary</p>
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #1a1a1a;color:#7a8a7e;font-size:13px;width:48%;">Garment</td>
        <td style="padding:10px 0;border-bottom:1px solid #1a1a1a;color:#f5f7f4;font-size:13px;font-weight:700;">${d.garmentName || '—'}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #1a1a1a;color:#7a8a7e;font-size:13px;">Quantity</td>
        <td style="padding:10px 0;border-bottom:1px solid #1a1a1a;color:#f5f7f4;font-size:13px;font-weight:700;">${d.qty || '—'} units</td>
      </tr>
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #1a1a1a;color:#7a8a7e;font-size:13px;">Print Location</td>
        <td style="padding:10px 0;border-bottom:1px solid #1a1a1a;color:#f5f7f4;font-size:13px;font-weight:700;">${d.printLocation || '—'}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #1a1a1a;color:#7a8a7e;font-size:13px;">Ink Colors</td>
        <td style="padding:10px 0;border-bottom:1px solid #1a1a1a;color:#f5f7f4;font-size:13px;font-weight:700;">${d.inkColors || '—'}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #1a1a1a;color:#7a8a7e;font-size:13px;">Artwork</td>
        <td style="padding:10px 0;border-bottom:1px solid #1a1a1a;color:#f5f7f4;font-size:13px;font-weight:700;">${artworkLabels[d.artworkStatus] || d.artworkStatus || '—'}</td>
      </tr>
      <tr>
        <td style="padding:12px 0 4px;color:#7a8a7e;font-size:13px;">Estimated Total</td>
        <td style="padding:12px 0 4px;color:#20ff7b;font-size:18px;font-weight:900;">${d.estimatedTotal || '—'}</td>
      </tr>
    </table>
    <p style="margin:14px 0 0;font-size:11px;color:#7a8a7e;line-height:1.5;">This is an estimate only. Final pricing is confirmed after 11R Print reviews your artwork and order requirements.</p>
  </div>

  <!-- What's next -->
  <div style="padding:24px 32px;background:#141918;border-top:1px solid #1a1a1a;">
    <p style="margin:0 0 14px;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.14em;color:#20ff7b;">What Happens Next</p>
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:8px 12px 8px 0;vertical-align:top;width:28px;color:#20ff7b;font-size:13px;font-weight:900;">01</td>
        <td style="padding:8px 0;color:#dce7df;font-size:13px;line-height:1.5;">We review your artwork and order details.</td>
      </tr>
      <tr>
        <td style="padding:8px 12px 8px 0;vertical-align:top;color:#20ff7b;font-size:13px;font-weight:900;">02</td>
        <td style="padding:8px 0;color:#dce7df;font-size:13px;line-height:1.5;">We confirm final pricing and send a proof for your approval.</td>
      </tr>
      <tr>
        <td style="padding:8px 12px 8px 0;vertical-align:top;color:#20ff7b;font-size:13px;font-weight:900;">03</td>
        <td style="padding:8px 0;color:#dce7df;font-size:13px;line-height:1.5;">Once approved, we print and fulfill your order.</td>
      </tr>
    </table>
  </div>

  <!-- CTA -->
  <div style="padding:28px 32px;background:#0d0f0e;text-align:center;border-top:1px solid #1a1a1a;">
    <p style="margin:0 0 18px;color:#7a8a7e;font-size:13px;">Questions? Reply to this email or reach us at</p>
    <a href="mailto:Orders@11rprint.com" style="color:#20ff7b;font-size:14px;font-weight:900;text-decoration:none;letter-spacing:.04em;">Orders@11rprint.com</a>
  </div>

  <!-- Footer -->
  <div style="padding:18px 32px;background:#050706;border-top:1px solid #111;">
    <p style="margin:0;font-size:11px;color:#7a8a7e;text-align:center;">11R Print · Custom Screen Printing · Real Ink. Real Durability.<br>Screen Printed, Not Pressed.</p>
  </div>

</div>`;

  const RESEND_KEY = process.env.RESEND_API_KEY;
  const headers = {
    'Authorization': `Bearer ${RESEND_KEY}`,
    'Content-Type': 'application/json',
  };

  // Send internal notification
  const internalRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      from: 'Orders <orders@11rprint.com>',
      to: ['Orders@11rprint.com'],
      reply_to: d.email || undefined,
      subject: `New Quote — ${d.fullName || 'Customer'} · ${d.qty || '?'} ${d.garmentName || 'units'}`,
      html: internalHtml,
    }),
  });

  if (!internalRes.ok) {
    const err = await internalRes.text();
    console.error('Resend internal error:', err);
    return { statusCode: 502, headers: cors, body: JSON.stringify({ error: 'Email failed', detail: err }) };
  }

  // Send customer confirmation (fire-and-forget — don't block success if it fails)
  if (d.email) {
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        from: '11R Print <orders@11rprint.com>',
        to: [d.email],
        subject: `We received your quote request — 11R Print`,
        html: customerHtml,
      }),
    }).catch(err => console.error('Customer email error:', err));
  }

  return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true }) };
};
