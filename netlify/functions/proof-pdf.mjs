import { generate } from '@pdfme/generator';
import { text, image, table, line, rectangle } from '@pdfme/schemas';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
  // Load black & green logo bundled with the function
  try {
    const logoPath = join(__dirname, '../../public/images/11r-logo-black.png');
    const buf = readFileSync(logoPath);
    _logo = `data:image/png;base64,${buf.toString('base64')}`;
    return _logo;
  } catch (_) {}
  // Fallback: fetch from live site
  try {
    const r = await fetch('https://11rprint.com/images/11r-logo-black.png');
    if (r.ok) {
      const buf = await r.arrayBuffer();
      _logo = `data:image/png;base64,${Buffer.from(buf).toString('base64')}`;
      return _logo;
    }
  } catch (_) {}
  _logo = null;
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

  const metaLabels = 'Proof Date :\nApproval Date :\nApproved By :';
  const metaValues = `${fmtDate(created_at)}\n${fmtDate(approved_at)}\n${approved_by || '—'}`;

  const T = (name, x, y, w, h, sz, col, align, vAlign = 'middle') => ({
    name, type: 'text',
    position: { x, y }, width: w, height: h,
    fontSize: sz, fontColor: col, backgroundColor: '',
    alignment: align, verticalAlignment: vAlign,
    lineHeight: 1, characterSpacing: 0, fontName: 'NotoSans',
  });
  const L = (name, x, y, w, col) => ({ name, type: 'line', position: { x, y }, width: w, height: 0, color: col });
  const Rect = (name, x, y, w, h, col) => ({ name, type: 'rectangle', position: { x, y }, width: w, height: h, color: col, borderWidth: 0, borderColor: '' });

  try {
    const [fontData, logoData] = await Promise.all([getFont(), getLogo()]);
    const font = { NotoSans: { data: fontData, fallback: true, subset: false } };

    // ── Layout constants (all mm, A4 = 210×297) ──
    // Zone 1  Header        y: 12–50
    // Zone 2  Separator     y: 52
    // Zone 3  Customer      y: 55–72
    // Zone 4  Separator     y: 75
    // Zone 5  Info row      y: 78–106
    // Zone 6  Separator     y: 109
    // Zone 7  Table         y: 112–192
    // Zone 8  Totals        y: 195–222
    // Zone 9  Signature     y: 225–238
    // Zone 10 Footer        y: 241–250

    const template = {
      basePdf: { width: 210, height: 297, padding: [0, 0, 0, 0] },
      schemas: [[
        ...(logoData ? [{ name: 'logo', type: 'image', position: { x: 15, y: 10 }, width: 85, height: 34 }] : []),
        T('title',      105, 10,  90, 22,  32,  '#111111', 'right'),
        T('proof_num',  105, 34,  90,  7,  10,  '#666666', 'right'),
        T('status_ok',  105, 43,  90,  7,   9,  '#005528', 'right'),
        L('hdr_sep',     15, 58, 180, '#111111'),
        Rect('cust_bar', 15, 62,   3, 18, '#111111'),
        T('prep_lbl',    21, 63,  90,  5,   7,  '#999999', 'left'),
        T('cust_name',   21, 70, 150, 10,  14,  '#111111', 'left'),
        L('cust_sep',    15, 82, 180, '#dddddd'),
        T('co_name',     15, 86,  80,  7,  10,  '#111111', 'left'),
        T('co_loc',      15, 95,  80,  6,   9,  '#777777', 'left'),
        T('co_email2',   15,103,  80,  6,   9,  '#777777', 'left'),
        { ...T('meta_lbl', 108, 86, 52, 30, 9, '#888888', 'right', 'top'), lineHeight: 2.2 },
        { ...T('meta_val', 162, 86, 33, 30, 9, '#111111', 'right', 'top'), lineHeight: 2.2 },
        L('info_sep',    15,116, 180, '#dddddd'),
        { name: 'line_items', type: 'table', position: { x: 15, y: 119 }, width: 180, height: 80,
          showHead: true, repeatHead: false,
          head: ['#', 'Description', 'Qty', 'Rate', 'Amount'],
          headWidthPercentages: [6, 52, 14, 14, 14],
          tableStyles: { borderColor: '#e0e0e0', borderWidth: 0.3 },
          headStyles: { fontName: 'NotoSans', alignment: 'left', verticalAlignment: 'middle', fontSize: 8.5, lineHeight: 1.3, characterSpacing: 0.3, fontColor: '#ffffff', backgroundColor: '#111111', borderColor: '', borderWidth: { top: 0, right: 0, bottom: 0, left: 0 }, padding: { top: 5, right: 5, bottom: 5, left: 5 } },
          bodyStyles: { fontName: 'NotoSans', alignment: 'left', verticalAlignment: 'middle', fontSize: 9.5, lineHeight: 1.4, characterSpacing: 0, fontColor: '#333333', backgroundColor: '', alternateBackgroundColor: '#f9f9f9', borderColor: '#eeeeee', borderWidth: { top: 0, right: 0, bottom: 0.3, left: 0 }, padding: { top: 6, right: 5, bottom: 6, left: 5 } },
          columnStyles: { alignment: { 2: 'right', 3: 'right', 4: 'right' } } },
        T('sub_lbl',    118,203,  47,  7,   9.5, '#666666', 'right'),
        T('sub_val',    167,203,  28,  7,   9.5, '#111111', 'right'),
        L('tot_sep',    118,212,  77, '#dddddd'),
        T('tot_lbl',    118,214,  47,  7,  10,   '#111111', 'right'),
        T('tot_val',    167,214,  28,  7,  10,   '#111111', 'right'),
        Rect('dep_bg',  118,223,  77, 11, '#f0f0f0'),
        T('dep_lbl',    118,224,  47,  9,  10.5, '#111111', 'right'),
        T('dep_val',    167,224,  28,  9,  10.5, '#111111', 'right'),
        Rect('sig_bg',   15,237, 180, 13, '#f5f5f5'),
        T('sig_lbl',     18,239,  90,  9,   7.5, '#999999', 'left'),
        T('sig_name',   110,239,  83,  9,  11,   '#111111', 'right'),
        L('ftr_sep',     15,255, 180, '#e0e0e0'),
        T('ftr_thanks',  15,258, 180,  6,   8.5, '#444444', 'left'),
        T('ftr_contact', 15,266, 180,  6,   8,   '#999999', 'left'),
      ]],
    };

    const inputs = [{
      ...(logoData ? { logo: logoData } : {}),
      title:       'ART PROOF',
      proof_num:   `# PRF-${proofRef}`,
      status_ok:   'Approval Confirmed',
      prep_lbl:    'PREPARED FOR',
      cust_name:   customer_name || 'Customer',
      co_name:     '11R Print',
      co_loc:      'Florida, U.S.A.',
      co_email2:   'orders@11rprint.com',
      meta_lbl:    metaLabels,
      meta_val:    metaValues,
      line_items:  JSON.stringify(rows),
      sub_lbl:     'Sub Total',
      sub_val:     fmt(subtotal),
      tot_lbl:     'Total',
      tot_val:     fmt(subtotal),
      dep_lbl:     'Deposit Due',
      dep_val:     fmt(deposit),
      sig_lbl:     'DIGITALLY SIGNED & APPROVED BY',
      sig_name:    approved_by || '—',
      ftr_thanks:  'Thanks for your business. Production begins upon receipt of deposit.',
      ftr_contact: 'Questions? orders@11rprint.com  ·  11rprint.com',
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
