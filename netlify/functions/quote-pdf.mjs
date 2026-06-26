import { generate } from '@pdfme/generator';
import { text, image, table, line, rectangle } from '@pdfme/schemas';

// Module-level cache — reused across warm Lambda invocations
let _font = null;
let _logo = null;

async function getFont() {
  if (_font) return _font;
  // Use TTF — WOFF2 triggers a subsetting bug in pdfme's fontkit
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
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers: corsHeaders, body: 'Bad JSON' }; }

  const {
    customer_name = '', customer_email = '', customer_phone = '',
    customer_company = '', product = '', shirt_color = '',
    print_location = '', ink_colors = 3, quantity = 0,
    sizes = {}, deadline = '', notes = '', estimate = {},
  } = body;

  const quoteNum = String(Date.now()).slice(-6);
  const quoteDate = fmtDate();

  // Pricing
  const garment  = parseFloat(estimate.garment)  || 0;
  const print    = parseFloat(estimate.print)     || 0;
  const discount = parseFloat(estimate.discount)  || 0;
  const setup    = parseFloat(estimate.setup)     || 0;
  const total    = parseFloat(estimate.total)     || (garment + print + setup - discount);
  const discLabel = estimate.discLabel || '';
  const deposit  = Math.ceil(total * 0.5 * 100) / 100; // 50% deposit

  const subtotal = garment + print + setup - discount;

  // Line items for table
  const qtyStr = parseFloat(quantity).toFixed(2);
  const garmentRate = quantity > 0 ? garment / quantity : 0;
  const printRate   = quantity > 0 ? print   / quantity : 0;

  const rows = [
    ['1', `Garment — ${product}\n${shirt_color}`, qtyStr, fmt(garmentRate), fmt(garment)],
    ['2', `Screen Print — ${print_location}\n${ink_colors} ink color${ink_colors !== 1 ? 's' : ''}`, qtyStr, fmt(printRate), fmt(print)],
    ['3', `Setup Fee\nScreen setup · ${ink_colors} color${ink_colors !== 1 ? 's' : ''}`, '1.00', fmt(setup), fmt(setup)],
  ];
  if (discount > 0) {
    rows.push(['4', `Volume Discount\n${discLabel}`, '1', `-${fmt(discount)}`, `-${fmt(discount)}`]);
  }

  // Meta right column — labels explicitly in inputs so pdfme always renders them
  const metaLabels = 'Quote Date :\nTerms :\nDeadline :\nDEPOSIT DUE :';
  const metaValues = `${quoteDate}\nEstimate\n${deadline || '—'}\n${fmt(deposit)}`;

  // Customer display: company if provided, else name
  const customerLine = customer_company
    ? `${customer_company}\n${customer_name}`
    : customer_name || 'Customer';

  try {
    const [fontData, logoData] = await Promise.all([getFont(), getLogo()]);
    const font = { NotoSans: { data: fontData, fallback: true, subset: false } };

    // ── TEMPLATE ─────────────────────────────────────────────────────────────
    // A4: 210 × 297 mm — layout mirrors Zoho invoice style
    const template = {
      basePdf: { width: 210, height: 297, padding: [0, 0, 0, 0] },
      schemas: [[

        // ── LOGO (top-left, sized to match Zoho proportions) ────────────────
        ...(logoData ? [{
          name: 'logo', type: 'image',
          position: { x: 15, y: 12 }, width: 50, height: 18,
        }] : []),

        // ── "QUOTE" title (top-right, large — mirrors Zoho "INVOICE") ───────
        {
          name: 'title', type: 'text',
          position: { x: 115, y: 12 }, width: 80, height: 14,
          fontSize: 28, fontColor: '#111111', backgroundColor: '',
          alignment: 'right', verticalAlignment: 'middle',
          lineHeight: 1, characterSpacing: 3, fontName: 'NotoSans',
        },

        // ── Quote number (mirrors Zoho "# INV-000002") ──────────────────────
        {
          name: 'quote_num', type: 'text',
          position: { x: 115, y: 28 }, width: 80, height: 8,
          fontSize: 11, fontColor: '#555555', backgroundColor: '',
          alignment: 'right', verticalAlignment: 'middle',
          lineHeight: 1, characterSpacing: 0, fontName: 'NotoSans',
        },

        // ── "Estimated Total" label (mirrors Zoho "Balance Due" label) ───────
        {
          name: 'est_label', type: 'text', content: 'Estimated Total',
          position: { x: 115, y: 39 }, width: 80, height: 7,
          fontSize: 9, fontColor: '#888888', backgroundColor: '',
          alignment: 'right', verticalAlignment: 'middle',
          lineHeight: 1, characterSpacing: 0, fontName: 'NotoSans',
        },

        // ── Large amount (mirrors Zoho large "$0.00") ────────────────────────
        {
          name: 'est_total_header', type: 'text',
          position: { x: 100, y: 47 }, width: 95, height: 18,
          fontSize: 26, fontColor: '#111111', backgroundColor: '',
          alignment: 'right', verticalAlignment: 'middle',
          lineHeight: 1, characterSpacing: 0, fontName: 'NotoSans',
        },

        // ── Divider line ────────────────────────────────────────────────────
        {
          name: 'header_sep', type: 'line',
          position: { x: 15, y: 71 }, width: 180, height: 0,
          color: '#e0e0e0',
        },

        // ── COMPANY INFO (left, matches Zoho left column) ───────────────────
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

        // ── META LABELS right (4 rows, mirrors Zoho right column) ───────────
        {
          name: 'meta_labels', type: 'text',
          position: { x: 105, y: 76 }, width: 55, height: 36,
          fontSize: 10, fontColor: '#888888', backgroundColor: '',
          alignment: 'right', verticalAlignment: 'top',
          lineHeight: 2.1, characterSpacing: 0, fontName: 'NotoSans',
        },

        // ── META VALUES right ────────────────────────────────────────────────
        {
          name: 'meta_values', type: 'text',
          position: { x: 162, y: 76 }, width: 33, height: 36,
          fontSize: 10, fontColor: '#111111', backgroundColor: '',
          alignment: 'right', verticalAlignment: 'top',
          lineHeight: 2.1, characterSpacing: 0, fontName: 'NotoSans',
        },

        // ── Divider line ────────────────────────────────────────────────────
        {
          name: 'meta_sep', type: 'line',
          position: { x: 15, y: 118 }, width: 180, height: 0,
          color: '#e0e0e0',
        },

        // ── CUSTOMER NAME + COMPANY (mirrors Zoho customer block) ───────────
        {
          name: 'customer_name', type: 'text',
          position: { x: 15, y: 123 }, width: 130, height: 14,
          fontSize: 12, fontColor: '#111111', backgroundColor: '',
          alignment: 'left', verticalAlignment: 'top',
          lineHeight: 1.6, characterSpacing: 0, fontName: 'NotoSans',
        },

        // ── LINE ITEMS TABLE ─────────────────────────────────────────────────
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

        // ── TOTALS SECTION (right side, mirrors Zoho totals) ─────────────────

        // Sub Total row
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

        // Thin line
        {
          name: 'totals_sep', type: 'line',
          position: { x: 110, y: 222 }, width: 85, height: 0,
          color: '#e0e0e0',
        },

        // Total row
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

        // Deposit row
        {
          name: 'deposit_label', type: 'text', content: 'Deposit Due (-)',
          position: { x: 110, y: 235 }, width: 55, height: 8,
          fontSize: 10, fontColor: '#555555', backgroundColor: '',
          alignment: 'right', verticalAlignment: 'middle',
          lineHeight: 1, characterSpacing: 0, fontName: 'NotoSans',
        },
        {
          name: 'deposit_val', type: 'text',
          position: { x: 167, y: 235 }, width: 28, height: 8,
          fontSize: 10, fontColor: '#555555', backgroundColor: '',
          alignment: 'right', verticalAlignment: 'middle',
          lineHeight: 1, characterSpacing: 0, fontName: 'NotoSans',
        },

        // Estimated Total highlighted row (mirrors "Balance Due")
        {
          name: 'est_bg', type: 'rectangle',
          position: { x: 108, y: 244 }, width: 87, height: 12,
          color: '#f0f0f0', borderWidth: 0, borderColor: '',
        },
        {
          name: 'est_row_label', type: 'text', content: 'Estimated Total',
          position: { x: 108, y: 245 }, width: 55, height: 10,
          fontSize: 11, fontColor: '#111111', backgroundColor: '',
          alignment: 'right', verticalAlignment: 'middle',
          lineHeight: 1, characterSpacing: 0, fontName: 'NotoSans',
        },
        {
          name: 'est_row_total', type: 'text',
          position: { x: 165, y: 245 }, width: 30, height: 10,
          fontSize: 11, fontColor: '#111111', backgroundColor: '',
          alignment: 'right', verticalAlignment: 'middle',
          lineHeight: 1, characterSpacing: 0, fontName: 'NotoSans',
        },

        // ── FOOTER ───────────────────────────────────────────────────────────
        {
          name: 'footer_line', type: 'line',
          position: { x: 15, y: 271 }, width: 180, height: 0,
          color: '#e0e0e0',
        },
        {
          name: 'footer_thanks', type: 'text', content: 'Thanks for your business.',
          position: { x: 15, y: 275 }, width: 180, height: 7,
          fontSize: 10, fontColor: '#333333', backgroundColor: '',
          alignment: 'left', verticalAlignment: 'middle',
          lineHeight: 1, characterSpacing: 0, fontName: 'NotoSans',
        },
        {
          name: 'footer_disc', type: 'text',
          content: 'This is an estimate only. Final pricing confirmed after artwork review within 1 business day.',
          position: { x: 15, y: 284 }, width: 180, height: 7,
          fontSize: 8.5, fontColor: '#888888', backgroundColor: '',
          alignment: 'left', verticalAlignment: 'middle',
          lineHeight: 1, characterSpacing: 0, fontName: 'NotoSans',
        },
      ]],
    };

    // ── INPUTS ────────────────────────────────────────────────────────────────
    const inputs = [{
      ...(logoData ? { logo: logoData } : {}),
      title: 'QUOTE',
      quote_num: `# QUO-${quoteNum}`,
      est_total_header: fmt(total),
      meta_labels: metaLabels,
      meta_values: metaValues,
      customer_name: customerLine,
      line_items: JSON.stringify(rows),
      sub_total: fmt(subtotal),
      total: fmt(total),
      deposit_val: fmt(deposit),
      est_row_total: fmt(total),
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
        'Content-Disposition': `attachment; filename="11rprint-quote-${quoteNum}.pdf"`,
      },
      body: Buffer.from(pdf).toString('base64'),
      isBase64Encoded: true,
    };
  } catch (err) {
    console.error('quote-pdf error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'PDF generation failed', detail: err.message }),
    };
  }
};
