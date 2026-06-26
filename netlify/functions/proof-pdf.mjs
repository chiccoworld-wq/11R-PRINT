import { generate } from '@pdfme/generator';
import { text, image, table, line, rectangle } from '@pdfme/schemas';

let _font = null;
let _logo = null;

async function getFont() {
  if (_font) return _font;
  // TTF only — WOFF2 triggers subsetting bug in pdfme/fontkit
  const r = await fetch(
    'https://fonts.gstatic.com/s/notosans/v42/o-0mIpQlx3QUlC5A4PNB6Ryti20_6n1iPHjcz6L1SoM-jCpoiyD9A99d.ttf'
  );
  if (!r.ok) throw new Error('Font fetch failed');
  _font = new Uint8Array(await r.arrayBuffer());
  return _font;
}

async function getLogo() {
  if (_logo) return _logo;
  try {
    const r = await fetch('https://11rprint.com/images/11R%20VECTOR%20FINAL%20SVG.png');
    if (!r.ok) return null;
    const buf = await r.arrayBuffer();
    _logo = `data:image/png;base64,${Buffer.from(buf).toString('base64')}`;
  } catch (_) {
    _logo = null;
  }
  return _logo;
}

function fmt(n) {
  const num = parseFloat(n) || 0;
  return '$' + num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function fmtDate(d) {
  return new Date(d || Date.now()).toLocaleDateString('en-US', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export const handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: corsHeaders, body: 'Method Not Allowed' };

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch {
    return { statusCode: 400, headers: corsHeaders, body: 'Bad JSON' };
  }

  const {
    proof = {},
    approved_by = '',
    approved_at = new Date().toISOString(),
  } = body;

  const {
    token = '',
    customer_name = '',
    pricing_items = [],
    deposit_amount = null,
    created_at = new Date().toISOString(),
  } = proof;

  const proofRef = token ? token.slice(-8).toUpperCase() : String(Date.now()).slice(-6);

  // Build totals from pricing items
  const subtotal = pricing_items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const deposit = deposit_amount !== null ? parseFloat(deposit_amount) : Math.ceil(subtotal * 0.5 * 100) / 100;

  // Table rows from proof pricing_items
  const rows = pricing_items.map((item, idx) => [
    String(idx + 1),
    String(item.description || ''),
    (parseFloat(item.qty) || 1).toFixed(2),
    fmt(item.rate),
    fmt(item.amount),
  ]);

  // If no pricing items, show placeholder
  if (rows.length === 0) {
    rows.push(['1', 'Custom Screen Print Order', '1.00', fmt(subtotal), fmt(subtotal)]);
  }

  const metaLabels = 'Proof Date :\nApproval Date :\nApproved By :\nDEPOSIT DUE :';
  const metaValues = `${fmtDate(created_at)}\n${fmtDate(approved_at)}\n${approved_by || '—'}\n${fmt(deposit)}`;

  try {
    const [fontData, logoData] = await Promise.all([getFont(), getLogo()]);
    const font = { NotoSans: { data: fontData, fallback: true, subset: false } };

    // A4: 210 × 297 mm — matches quote PDF structure exactly
    const template = {
      basePdf: { width: 210, height: 297, padding: [0, 0, 0, 0] },
      schemas: [[

        // ── LOGO ─────────────────────────────────────────────────────────────
        ...(logoData ? [{
          name: 'logo', type: 'image',
          position: { x: 15, y: 12 }, width: 50, height: 18,
        }] : []),

        // ── "PROOF" title ─────────────────────────────────────────────────────
        {
          name: 'title', type: 'text',
          position: { x: 115, y: 12 }, width: 80, height: 14,
          fontSize: 28, fontColor: '#111111', backgroundColor: '',
          alignment: 'right', verticalAlignment: 'middle',
          lineHeight: 1, characterSpacing: 3, fontName: 'NotoSans',
        },

        // ── Proof reference number ─────────────────────────────────────────────
        {
          name: 'proof_num', type: 'text',
          position: { x: 115, y: 28 }, width: 80, height: 8,
          fontSize: 11, fontColor: '#555555', backgroundColor: '',
          alignment: 'right', verticalAlignment: 'middle',
          lineHeight: 1, characterSpacing: 0, fontName: 'NotoSans',
        },

        // ── "Approval Confirmed" label ────────────────────────────────────────
        {
          name: 'status_label', type: 'text', content: 'Approval Confirmed',
          position: { x: 115, y: 39 }, width: 80, height: 7,
          fontSize: 9, fontColor: '#006633', backgroundColor: '',
          alignment: 'right', verticalAlignment: 'middle',
          lineHeight: 1, characterSpacing: 0, fontName: 'NotoSans',
        },

        // ── Deposit Due (large amount — mirrors Zoho "Balance Due") ───────────
        {
          name: 'deposit_header', type: 'text',
          position: { x: 100, y: 47 }, width: 95, height: 18,
          fontSize: 26, fontColor: '#111111', backgroundColor: '',
          alignment: 'right', verticalAlignment: 'middle',
          lineHeight: 1, characterSpacing: 0, fontName: 'NotoSans',
        },

        // ── Header divider ────────────────────────────────────────────────────
        {
          name: 'header_sep', type: 'line',
          position: { x: 15, y: 71 }, width: 180, height: 0,
          color: '#e0e0e0',
        },

        // ── COMPANY INFO ──────────────────────────────────────────────────────
        {
          name: 'co_name', type: 'text', content: '11R Print',
          position: { x: 15, y: 76 }, width: 90, height: 8,
          fontSize: 11, fontColor: '#111111', backgroundColor: '',
          alignment: 'left', verticalAlignment: 'middle',
          lineHeight: 1, characterSpacing: 0, fontName: 'NotoSans',
        },
        {
          name: 'co_info', type: 'text',
          content: 'Florida\nU.S.A.\n+1 (407) 720-8518\norders@11rprint.com',
          position: { x: 15, y: 86 }, width: 90, height: 28,
          fontSize: 10, fontColor: '#555555', backgroundColor: '',
          alignment: 'left', verticalAlignment: 'top',
          lineHeight: 1.7, characterSpacing: 0, fontName: 'NotoSans',
        },

        // ── META LABELS (4 rows) ──────────────────────────────────────────────
        {
          name: 'meta_labels', type: 'text',
          position: { x: 105, y: 76 }, width: 55, height: 36,
          fontSize: 10, fontColor: '#888888', backgroundColor: '',
          alignment: 'right', verticalAlignment: 'top',
          lineHeight: 2.1, characterSpacing: 0, fontName: 'NotoSans',
        },

        // ── META VALUES ───────────────────────────────────────────────────────
        {
          name: 'meta_values', type: 'text',
          position: { x: 162, y: 76 }, width: 33, height: 36,
          fontSize: 10, fontColor: '#111111', backgroundColor: '',
          alignment: 'right', verticalAlignment: 'top',
          lineHeight: 2.1, characterSpacing: 0, fontName: 'NotoSans',
        },

        // ── Meta divider ──────────────────────────────────────────────────────
        {
          name: 'meta_sep', type: 'line',
          position: { x: 15, y: 118 }, width: 180, height: 0,
          color: '#e0e0e0',
        },

        // ── CUSTOMER NAME ─────────────────────────────────────────────────────
        {
          name: 'customer_name', type: 'text',
          position: { x: 15, y: 123 }, width: 130, height: 14,
          fontSize: 12, fontColor: '#111111', backgroundColor: '',
          alignment: 'left', verticalAlignment: 'top',
          lineHeight: 1.6, characterSpacing: 0, fontName: 'NotoSans',
        },

        // ── LINE ITEMS TABLE ──────────────────────────────────────────────────
        {
          name: 'line_items', type: 'table',
          position: { x: 15, y: 143 }, width: 180, height: 62,
          showHead: true, repeatHead: false,
          head: ['#', 'Description', 'Qty', 'Rate', 'Amount'],
          headWidthPercentages: [6, 52, 14, 14, 14],
          tableStyles: { borderColor: '#e0e0e0', borderWidth: 0.3 },
          headStyles: {
            fontName: 'NotoSans',
            alignment: 'left', verticalAlignment: 'middle',
            fontSize: 9, lineHeight: 1.4, characterSpacing: 0.3,
            fontColor: '#ffffff', backgroundColor: '#1a1a1a',
            borderColor: '', borderWidth: { top: 0, right: 0, bottom: 0, left: 0 },
            padding: { top: 5, right: 6, bottom: 5, left: 6 },
          },
          bodyStyles: {
            fontName: 'NotoSans',
            alignment: 'left', verticalAlignment: 'top',
            fontSize: 10, lineHeight: 1.5, characterSpacing: 0,
            fontColor: '#333333', backgroundColor: '',
            alternateBackgroundColor: '',
            borderColor: '#e8e8e8',
            borderWidth: { top: 0, right: 0, bottom: 0.3, left: 0 },
            padding: { top: 8, right: 6, bottom: 8, left: 6 },
          },
          columnStyles: { alignment: { 2: 'right', 3: 'right', 4: 'right' } },
        },

        // ── TOTALS ────────────────────────────────────────────────────────────

        {
          name: 'sub_total_label', type: 'text', content: 'Sub Total',
          position: { x: 110, y: 212 }, width: 55, height: 8,
          fontSize: 10, fontColor: '#555555', backgroundColor: '',
          alignment: 'right', verticalAlignment: 'middle',
          lineHeight: 1, characterSpacing: 0, fontName: 'NotoSans',
        },
        {
          name: 'sub_total', type: 'text',
          position: { x: 167, y: 212 }, width: 28, height: 8,
          fontSize: 10, fontColor: '#111111', backgroundColor: '',
          alignment: 'right', verticalAlignment: 'middle',
          lineHeight: 1, characterSpacing: 0, fontName: 'NotoSans',
        },

        {
          name: 'totals_sep', type: 'line',
          position: { x: 110, y: 222 }, width: 85, height: 0,
          color: '#e0e0e0',
        },

        {
          name: 'total_label', type: 'text', content: 'Total',
          position: { x: 110, y: 224 }, width: 55, height: 9,
          fontSize: 11, fontColor: '#111111', backgroundColor: '',
          alignment: 'right', verticalAlignment: 'middle',
          lineHeight: 1, characterSpacing: 0, fontName: 'NotoSans',
        },
        {
          name: 'total', type: 'text',
          position: { x: 167, y: 224 }, width: 28, height: 9,
          fontSize: 11, fontColor: '#111111', backgroundColor: '',
          alignment: 'right', verticalAlignment: 'middle',
          lineHeight: 1, characterSpacing: 0, fontName: 'NotoSans',
        },

        // ── DEPOSIT DUE (highlighted — mirrors Zoho "Balance Due") ───────────
        {
          name: 'est_bg', type: 'rectangle',
          position: { x: 108, y: 235 }, width: 87, height: 12,
          color: '#f0f0f0', borderWidth: 0, borderColor: '',
        },
        {
          name: 'est_row_label', type: 'text', content: 'Deposit Due',
          position: { x: 108, y: 236 }, width: 55, height: 10,
          fontSize: 11, fontColor: '#111111', backgroundColor: '',
          alignment: 'right', verticalAlignment: 'middle',
          lineHeight: 1, characterSpacing: 0, fontName: 'NotoSans',
        },
        {
          name: 'est_row_total', type: 'text',
          position: { x: 165, y: 236 }, width: 30, height: 10,
          fontSize: 11, fontColor: '#111111', backgroundColor: '',
          alignment: 'right', verticalAlignment: 'middle',
          lineHeight: 1, characterSpacing: 0, fontName: 'NotoSans',
        },

        // ── APPROVAL SIGNATURE BLOCK ──────────────────────────────────────────
        {
          name: 'sig_bg', type: 'rectangle',
          position: { x: 15, y: 253 }, width: 180, height: 14,
          color: '#f8f8f8', borderWidth: 0.3, borderColor: '#e0e0e0',
        },
        {
          name: 'sig_label', type: 'text', content: 'DIGITALLY SIGNED & APPROVED BY',
          position: { x: 18, y: 255 }, width: 90, height: 10,
          fontSize: 8, fontColor: '#888888', backgroundColor: '',
          alignment: 'left', verticalAlignment: 'middle',
          lineHeight: 1, characterSpacing: 0.5, fontName: 'NotoSans',
        },
        {
          name: 'sig_name', type: 'text',
          position: { x: 110, y: 255 }, width: 83, height: 10,
          fontSize: 11, fontColor: '#111111', backgroundColor: '',
          alignment: 'right', verticalAlignment: 'middle',
          lineHeight: 1, characterSpacing: 0, fontName: 'NotoSans',
        },

        // ── FOOTER ────────────────────────────────────────────────────────────
        {
          name: 'footer_line', type: 'line',
          position: { x: 15, y: 274 }, width: 180, height: 0,
          color: '#e0e0e0',
        },
        {
          name: 'footer_thanks', type: 'text', content: 'Thanks for your business. Production begins upon receipt of deposit.',
          position: { x: 15, y: 278 }, width: 180, height: 7,
          fontSize: 10, fontColor: '#333333', backgroundColor: '',
          alignment: 'left', verticalAlignment: 'middle',
          lineHeight: 1, characterSpacing: 0, fontName: 'NotoSans',
        },
        {
          name: 'footer_disc', type: 'text',
          content: 'Questions? Contact us at orders@11rprint.com | 11rprint.com',
          position: { x: 15, y: 287 }, width: 180, height: 7,
          fontSize: 8.5, fontColor: '#888888', backgroundColor: '',
          alignment: 'left', verticalAlignment: 'middle',
          lineHeight: 1, characterSpacing: 0, fontName: 'NotoSans',
        },
      ]],
    };

    const inputs = [{
      ...(logoData ? { logo: logoData } : {}),
      title: 'PROOF',
      proof_num: `# PRF-${proofRef}`,
      deposit_header: fmt(deposit),
      meta_labels: metaLabels,
      meta_values: metaValues,
      customer_name: customer_name || 'Customer',
      line_items: JSON.stringify(rows),
      sub_total: fmt(subtotal),
      total: fmt(subtotal),
      est_row_total: fmt(deposit),
      sig_name: approved_by || '—',
    }];

    const pdf = await generate({
      template,
      inputs,
      options: { font },
      plugins: { text, image, table, line, rectangle },
    });

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="11rprint-proof-${proofRef}.pdf"`,
      },
      body: Buffer.from(pdf).toString('base64'),
      isBase64Encoded: true,
    };
  } catch (err) {
    console.error('proof-pdf error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'PDF generation failed', detail: err.message }),
    };
  }
};
