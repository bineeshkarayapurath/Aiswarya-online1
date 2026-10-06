const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const config = require('../config/constants');
const { pdfDir, qrDir } = require('../utils/storage');
const { resolveMediaImage, warnUnreadableOnce } = require('../utils/mediaImage');
const { drawSignature, getClubSignatures } = require('./signatureService');
const { getClubContact } = require('./clubContactService');

const MM = 72 / 25.4;

// Prefer the client's real logo; fall back to a generated placeholder.
const clubLogoPath = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'client',
  'public',
  'assets',
  'club-logo.png'
);
const logoPath = fs.existsSync(clubLogoPath) ? clubLogoPath : null;

function sanitize(name) {
  return String(name || '').replace(/[^a-zA-Z0-9-_]/g, '_');
}

function clubFullName() {
  return config.CLUB.fullName;
}

function formatDate(date) {
  if (!date) return '—';
  const d = new Date(date);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

async function writeQrImage(payload, filename) {
  const file = path.join(qrDir(), filename);
  await QRCode.toFile(file, payload, { width: 260, margin: 1 });
  return file;
}

/**
 * Officer signature block for the foot of an A4 document: the signature rests
 * on a rule, with the officer's name and designation beneath it, followed by the
 * number the club publishes for that post.
 *
 * `bottomY` is the y of the rule. The whole block is skipped when the post has
 * no signature configured — a document must never carry a blank line that reads
 * as a signature. When a signature is configured but the image cannot be read
 * (dead ImgBB link), the name and rule are still printed rather than failing.
 */
async function officerSignatureBlock(doc, { url, name, designation, phone }, { x, w, bottomY }) {
  if (!url) return false;

  const lineColor = config.CLUB.colors.primary900;
  const grey = config.CLUB.colors.grey;
  const imgH = 40;

  await drawSignature(doc, url, { x: x + 8, y: bottomY - imgH, w: w - 16, h: imgH });

  doc.moveTo(x, bottomY).lineTo(x + w, bottomY).lineWidth(0.75).strokeColor(lineColor).stroke();

  const label = [name, designation].filter(Boolean).join(', ');
  if (label) {
    doc.font('Helvetica-Bold').fontSize(9).fillColor(lineColor).text(label, x, bottomY + 4, {
      width: w,
      align: 'center',
    });
  }
  doc.font('Helvetica').fontSize(7.5).fillColor(grey).text('Authorised Signatory', x, bottomY + 16, {
    width: w,
    align: 'center',
  });
  if (phone) {
    doc.text(phone, x, bottomY + 25, { width: w, align: 'center' });
  }
  return true;
}

// Officer signature blocks laid out across the foot of a document. When both the
// President and the Secretary have a signature they sit side by side; a lone
// signature gets the full block width on the right, where an approval signature
// belongs. The layout is decided before anything is drawn — drawing first and
// re-positioning afterwards would stamp the same signature onto the page twice.
async function documentSignatureBlocks(doc, signatures) {
  const W = doc.page.width;
  const M = 46;
  const ruleY = doc.page.height - M - 78;

  const officers = [
    {
      url: signatures.presidentSignatureUrl,
      name: signatures.presidentName,
      designation: 'President',
      phone: signatures.presidentPhone,
    },
    {
      url: signatures.secretarySignatureUrl,
      name: signatures.secretaryName,
      designation: 'Secretary',
      phone: signatures.secretaryPhone,
    },
  ].filter((o) => o.url);

  if (!officers.length) return;

  if (officers.length === 1) {
    const w = 220;
    await officerSignatureBlock(doc, officers[0], { x: W - M - w, w, bottomY: ruleY });
    return;
  }

  const w = 210;
  await officerSignatureBlock(doc, officers[0], { x: M, w, bottomY: ruleY });
  await officerSignatureBlock(doc, officers[1], { x: W - M - w, w, bottomY: ruleY });
}

/**
 * Address / phone / email strip for the letterhead, drawn under the Reg No line.
 *
 * Every value comes from clubContactService, so the letterhead, the ID cards and
 * the website always print the same current details instead of a second hardcoded
 * copy drifting out of step with them. Returns the y the caller can continue from.
 */
function letterheadContact(doc, contact, { x, w, y }) {
  const grey = config.CLUB.colors.grey;

  const lines = [contact.address, [contact.phone, contact.email].filter(Boolean).join('  •  ')]
    .filter(Boolean)
    .map((text) => cleanText(text));

  doc.font('Helvetica').fontSize(7.5).fillColor(grey);
  lines.forEach((text) => {
    doc.text(text, x, y, { width: w, align: 'center' });
    y += doc.heightOfString(text, { width: w, align: 'center' }) + 1.5;
  });
  return y;
}

/** ------------------------------------------------------------------ *
 *  Official Application / Letterhead PDF (A4) — fits on a single page
 * ------------------------------------------------------------------ */
function cleanText(v) {
  return String(v || '')
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Embed a member's photo on any generated document. `photoUrl` may be a local
// storage path, a data URI, or an absolute URL on an external image host
// (ImgBB / Cloudinary / Firebase). PDFKit can only embed a path or a Buffer, so
// remote photos are downloaded once and cached under storage/media-cache/.
//
// Returns true when an image was actually embedded. Callers use that to decide
// whether to print the "Photo" placeholder: an unreadable photo must not leave
// a blank frame that looks like the member supplied no picture.
async function drawMemberPhoto(doc, stored, { x, y, w, h, fit }) {
  const raw = String(stored || '').trim();
  if (!raw) return false;
  const img = await resolveMediaImage(raw, { subdir: 'media-cache', label: 'photo' });
  if (!img) {
    warnUnreadableOnce(
      'photo',
      raw,
      'If the member photo is an external URL the host may be unreachable, ' +
        'and if it is a local path the server disk may have been wiped on redeploy.',
    );
    return false;
  }
  try {
    doc.image(img, x, y, { fit: fit || [w, h], align: 'center', valign: 'center' });
    return true;
  } catch (e) {
    console.warn(`[photo] embed failed for ${raw}: ${e.message}`);
    return false;
  }
}

async function generateApplicationPdf(user, { approvedBy = '', approvedAt = null } = {}) {
  const doc = new PDFDocument({ size: 'A4', margin: 0 });
  const file = path.join(pdfDir(), `application_${user.membershipId || user._id}.pdf`);
  const stream = fs.createWriteStream(file);
  doc.pipe(stream);

  const W = doc.page.width;
  const H = doc.page.height;
  const M = 46;
  const lineColor = config.CLUB.colors.primary900;
  const gold = config.CLUB.colors.gold;
  const grey = config.CLUB.colors.grey;
  const ink = config.CLUB.colors.ink;
  const pageBottom = H - M;
  // Resolved once per document: address, email and the officer phones are the
  // club's current values, not a second hardcoded copy in this file.
  const contact = await getClubContact();

  // ======================= HEADER =======================
  const headerTop = 34;
  const titleX = M + 82;
  const titleW = W - (M + 82) - M;
  const titleText = clubFullName(); // "... , Kuppakolly"

  if (logoPath) doc.image(logoPath, M, headerTop, { width: 66, height: 66 });

  // Title block — wrap cleanly, then measure so nothing overlaps below it.
  doc.font('Helvetica-Bold').fontSize(15).fillColor(lineColor);
  doc.text(titleText, titleX, headerTop + 4, {
    width: titleW,
    align: 'center',
    height: 46,
  });
  const titleH = doc.heightOfString(titleText, { width: titleW, align: 'center' });
  let hdrY = headerTop + 4 + Math.min(titleH, 46);

  doc.font('Helvetica').fontSize(9).fillColor(grey);
  doc.text(config.CLUB.tagline, titleX, hdrY + 3, { width: titleW, align: 'center' });
  hdrY += 15;

  const regLine = `Reg No: ${config.CLUB.regNo}`;
  doc.font('Helvetica-Bold').fontSize(11).fillColor(gold);
  doc.text(regLine, titleX, hdrY, { width: titleW, align: 'center' });
  hdrY += doc.heightOfString(regLine, { width: titleW, align: 'center' }) + 4;

  hdrY = letterheadContact(doc, contact, { x: titleX, w: titleW, y: hdrY });

  const lineY = Math.max(hdrY + 8, headerTop + 78);
  doc.moveTo(M, lineY).lineTo(W - M, lineY).lineWidth(2).strokeColor(gold).stroke();
  doc.moveTo(M, lineY + 3).lineTo(W - M, lineY + 3).lineWidth(0.75).strokeColor(lineColor).stroke();

  // ======================= TITLE =======================
  let y = lineY + 24;
  doc.font('Helvetica-Bold').fontSize(15).fillColor(lineColor);
  doc.text('Membership Application', M + 8, y, { align: 'center' });
  y += 17;
  doc.font('Helvetica').fontSize(9).fillColor(grey);
  doc.text('(Receipt of Application & Record of Approval)', M + 8, y, {
    width: W - M * 2 - 16,
    align: 'center',
  });
  y += 17;

  // ======================= PHOTO (right) =======================
  const photoW = 78;
  const photoH = 92;
  const photoX = W - M - photoW;
  const photoY = y - 4;

  // ======================= APPLICANT DETAILS (left) =======================
  doc.font('Helvetica-Bold').fontSize(11).fillColor(lineColor);
  doc.text('Member Details', M + 8, y);
  y += 23;

  const rows = [
    ['Membership ID', user.membershipId || 'Pending'],
    ['Full Name', cleanText(user.fullName)],
    ['Date of Birth', formatDate(user.dob)],
    ['Age', user.age ? `${user.age} years` : '—'],
    ['Phone', cleanText(user.phoneNumber)],
    ['Occupation', cleanText(user.occupation) || '—'],
    ['Qualification', cleanText(user.education) || '—'],
    ['Address', cleanText(user.address) || '—'],
  ];

  const detailLeft = M + 8;
  const detailRight = photoX - 18;
  const labelW = 118;
  const valueX = detailLeft + labelW + 6;
  const valueW = detailRight - valueX;

  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(lineColor);
  rows.forEach(([label, value]) => {
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(lineColor);
    doc.text(label, detailLeft, y, { width: labelW });
    doc.font('Helvetica').fontSize(9.5).fillColor(ink);
    doc.text(value, valueX, y, { width: valueW });
    const h = doc.heightOfString(value, { width: valueW });
    y += h + 3.5;
  });

  // Photo
  const photoDrawn = await drawMemberPhoto(doc, user.photoUrl, { x: photoX, y: photoY, w: photoW, h: photoH });
  doc.rect(photoX, photoY, photoW, photoH).lineWidth(1).strokeColor(grey).stroke();
  if (!photoDrawn) {
    doc.font('Helvetica').fontSize(8).fillColor(grey).text('Photo', photoX, photoY + photoH / 2 - 5, { width: photoW, align: 'center' });
  }

  // ======================= RECOMMENDER =======================
  y += 16;
  doc.font('Helvetica-Bold').fontSize(11).fillColor(lineColor);
  doc.text('Recommender', M + 8, y);
  y += 17;
  doc.font('Helvetica').fontSize(9.5).fillColor(ink);
  doc.text(
    `Name: ${cleanText(user.recommender.name) || '—'}     Member ID: ${cleanText(user.recommender.memberId) || '—'}`,
    M + 8,
    y,
    { width: detailRight - M - 8 }
  );
  y += 17;

  // ======================= APPROVAL STAMP =======================
  const stampW = 168;
  const stampH = 76;
  const stampX = W - M - stampW;
  const stampY = y + 4;
  doc.roundedRect(stampX, stampY, stampW, stampH, 8)
    .lineWidth(1.5)
    .strokeColor(lineColor)
    .stroke();
  doc.font('Helvetica-Bold').fontSize(12.5).fillColor(lineColor).text(
    'APPROVED',
    stampX,
    stampY + 10,
    { width: stampW, align: 'center' }
  );
  doc.font('Helvetica').fontSize(8).fillColor(grey);
  doc.text(
    `Authorised by: ${cleanText(approvedBy) || 'Club Authority'}`,
    stampX,
    stampY + 30,
    { width: stampW, align: 'center' }
  );
  doc.text(`Date: ${formatDate(approvedAt)}`, stampX, stampY + 46, {
    width: stampW,
    align: 'center',
  });
  doc.moveTo(M, stampY + 12).lineTo(stampX - 24, stampY + 12).lineWidth(0.5).strokeColor('#cbd5e1').stroke();

  // ======================= OFFICER SIGNATURES =======================
  // Club-configured President / Secretary signatures, appended above the footer.
  await documentSignatureBlocks(doc, await getClubSignatures());

  // ======================= FOOTER (page 1, single page) =======================
  doc.font('Helvetica').fontSize(9).fillColor(grey);
  doc.text(
    'This is a computer generated document. Any signature shown is the club’s stored official signature.',
    M,
    pageBottom - 42,
    { width: W - M * 2, align: 'center', italic: true }
  );
  doc.font('Helvetica').fontSize(9.5).fillColor(grey);
  doc.text(
    'Certificate of Membership • Digital Record',
    M,
    pageBottom - 24,
    { width: W - M * 2, align: 'center' }
  );

  doc.end();
  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
  return file;
}

/** ------------------------------------------------------------------ *
 *  Digital ID Card — CR80 Standard (85.6mm x 53.98mm), Front & Back
 * ------------------------------------------------------------------ */
const CARD_W = 85.6 * MM;
const CARD_H = 53.98 * MM;

async function generateIdCardPdf(user) {
  const doc = new PDFDocument({ size: [CARD_W, CARD_H], margin: 0 });
  const file = path.join(pdfDir(), `idcard_${user.membershipId || user._id}.pdf`);
  const stream = fs.createWriteStream(file);
  doc.pipe(stream);
  const contact = await getClubContact();

  // ---- FRONT ----
  const gold = config.CLUB.colors.accentLight;
  const cream = config.CLUB.colors.cream;
  const emerald = config.CLUB.colors.primary900;
  const inkDark = '#111827';
  const inkSoft = config.CLUB.colors.grey;
  const labelColor = config.CLUB.colors.label;

  doc.rect(0, 0, CARD_W, CARD_H).fill(cream);

  // Header band — deep emerald with gold underline bar
  const headerH = 15 * MM;
  doc.rect(0, 0, CARD_W, headerH).fill(emerald);
  doc.rect(0, headerH, CARD_W, 0.45 * MM).fill(gold);

  if (logoPath) doc.image(logoPath, 2 * MM, 1.5 * MM, { width: 12 * MM, height: 12 * MM });

  // Main title — large bold, to the right of the emblem
  const titleX = logoPath ? 15.5 * MM : 4 * MM;
  const titleW = CARD_W - titleX - 2 * MM;
  const clubTitle = config.CLUB.longName;
  doc.font('Helvetica-Bold').fontSize(6.2).fillColor('#ffffff').text(clubTitle, titleX, 1.7 * MM, {
    width: titleW,
    lineBreak: true,
  });
  const titleH = doc.heightOfString(clubTitle, { width: titleW }) || 0;

  // Location + Reg No — centered below the title
  const subY = 1.7 * MM + titleH + 0.5 * MM;
  doc.font('Helvetica-Bold').fontSize(4.7).fillColor(gold).text(
    config.CLUB.place.toUpperCase(),
    titleX,
    subY,
    { width: titleW, align: 'center' }
  );
  doc.font('Helvetica-Bold').fontSize(4.3).fillColor('#ffffff').text(
    `Reg No: ${config.CLUB.regNo}`,
    titleX,
    subY + 2.1 * MM,
    { width: titleW, align: 'center' }
  );

  // Member body
  const bodyTop = headerH + 1.6 * MM;
  const bodyH = CARD_H - bodyTop;
  const photoW = 12.5 * MM;
  const photoH = 18 * MM;
  const photoX = 2.6 * MM;
  const photoY = bodyTop + 0.2 * MM;

  // Gold-framed photo (no background watermark). Resolved before the frame is
  // stroked so a photo that fails to load is reported rather than hidden behind
  // an empty placeholder.
  doc.rect(
    photoX - 0.6 * MM,
    photoY - 0.6 * MM,
    photoW + 1.2 * MM,
    photoH + 1.2 * MM
  ).lineWidth(0.7).strokeColor(gold).stroke();

  doc.rect(photoX, photoY, photoW, photoH).fill('#e8e2d1');
  await drawMemberPhoto(doc, user.photoUrl, { x: photoX, y: photoY, w: photoW, h: photoH });

  // QR code — far right, vertically centered in the body
  const qrSize = 15.5 * MM;
  const qrX = CARD_W - qrSize - 2.6 * MM;
  const qrY = bodyTop + (bodyH - qrSize) / 2;
  doc.roundedRect(qrX - 0.8 * MM, qrY - 0.8 * MM, qrSize + 1.6 * MM, qrSize + 1.6 * MM, 1 * MM)
    .fill('#ffffff')
    .lineWidth(0.6)
    .strokeColor(gold)
    .stroke();

  const qrPayload = JSON.stringify({
    t: config.CLUB.qrType,
    id: user.membershipId,
    name: user.fullName,
    phone: user.phoneNumber,
  });
  const qrFile = await writeQrImage(qrPayload, `qr_${user.membershipId || user._id}.png`);
  doc.image(qrFile, qrX, qrY, { width: qrSize, height: qrSize });

  // Member details — middle block between photo and QR
  const dx = photoX + photoW + 3.2 * MM;
  const dWidth = qrX - 2 * MM - dx;
  let dy = bodyTop + 0.2 * MM;

  // Full Name — bold & large
  doc.font('Helvetica-Bold').fontSize(7.2).fillColor(inkDark);
  doc.text(user.fullName || '', dx, dy, { width: dWidth });
  dy += (doc.heightOfString(user.fullName || '', { width: dWidth }) || 0) + 1.3 * MM;

  // Full Address — neat two-line block
  doc.font('Helvetica').fontSize(4.8).fillColor(inkSoft);
  doc.text(cleanText(user.address) || '—', dx, dy, { width: dWidth, height: 10.5 * 2 }); // ~2 lines
  dy += (doc.heightOfString(cleanText(user.address) || '—', { width: dWidth }) || 0) + 1.3 * MM;

  // Member ID — prominent amber badge
  const idLabel = `Member ID: ${user.membershipId || '—'}`;
  doc.font('Helvetica-Bold').fontSize(6);
  const idW = doc.widthOfString(idLabel);
  const pillH = 4 * MM;
  doc.roundedRect(dx - 0.8 * MM, dy, idW + 1.6 * MM, pillH, 0.9 * MM).fill(gold);
  doc.fillColor(emerald).text(idLabel, dx, dy + 0.85 * MM, { width: dWidth });
  dy += pillH + 1.5 * MM;

  // Designation — green pill, mirroring the on-screen card. Only office-holders
  // carry one, so an ordinary member's card is left unlabelled rather than
  // stamped with a generic "Member".
  const designation = cleanText(user.designation);
  if (designation) {
    doc.font('Helvetica-Bold').fontSize(5);
    const gW = doc.widthOfString(designation) + 1.6 * MM;
    const gH = 3.6 * MM;
    if (gW <= dWidth) {
      doc.roundedRect(dx - 0.8 * MM, dy, gW, gH, 0.9 * MM).fill(emerald);
      doc.fillColor(gold).text(designation, dx, dy + 0.8 * MM, { width: dWidth });
    } else {
      // Free-text designations can be longer than the badge allows; fall back
      // to a wrapped line so the exact wording is never cut off.
      doc.fillColor(inkSoft).text(designation, dx, dy + 0.5 * MM, { width: dWidth });
    }
    dy += gH + 1.2 * MM;
  }

  // Phone / Email / DOB rows
  const rows = [
    { label: 'Phone', value: user.phoneNumber || '' },
    user.email ? { label: 'Email', value: user.email } : null,
    { label: 'DOB', value: user.dob ? formatDate(user.dob) : '—' },
  ].filter(Boolean);

  rows.forEach((row) => {
    doc.font('Helvetica-Bold').fontSize(4).fillColor(labelColor).text(
      `${row.label.toUpperCase()}:  `,
      dx,
      dy,
      { continued: true, lineBreak: false }
    );
    doc.font('Helvetica').fontSize(5.3).fillColor(inkSoft).text(row.value, {
      width: dWidth,
    });
    dy += 4 * MM;
  });

  // ---- BACK ----
  doc.addPage({ size: [CARD_W, CARD_H], margin: 0 });
  doc.rect(0, 0, CARD_W, CARD_H).fill(cream);

  const backHeaderH = 6.5 * MM;
  doc.rect(0, 0, CARD_W, backHeaderH).fill(emerald);
  doc.rect(0, backHeaderH, CARD_W, 0.4 * MM).fill(gold);
  doc.font('Helvetica-Bold').fontSize(6).fillColor('#ffffff').text(
    'CLUB RULES & MEMBER INFORMATION',
    2 * MM,
    1.9 * MM,
    { width: CARD_W - 4 * MM, align: 'center' }
  );

  // Centered club logo watermark — strictly 30% opacity, behind the rules text
  if (logoPath) {
    doc.save();
    doc.opacity(0.3);
    doc.image(logoPath, CARD_W / 2 - 20 * MM, CARD_H / 2 - 20 * MM, {
      width: 40 * MM,
      height: 40 * MM,
    });
    doc.restore();
  }

  const rules = [
    '1. Members must present this card upon entry to the library.',
    '2. Keep the library premises clean and maintain silence inside.',
    '3. Books issued must be returned within the due date.',
    '4. The card is non-transferable and remains club property.',
    '5. Duplicate card will be issued on payment of a nominal fee.',
    '6. Members shall abide by the rules of the club committee.',
  ];

  doc.font('Helvetica').fontSize(5.2).fillColor(inkSoft);
  let ry = backHeaderH + 1.8 * MM;
  rules.forEach((r) => {
    doc.text(r, 4 * MM, ry, { width: CARD_W - 8 * MM });
    ry += 3.2 * MM;
  });

  // The rules block ends around 27mm, so the divider is pulled up to leave a
  // generous band for the signature above the 48.5mm rule.
  const dividerY = 36 * MM;

  // Official address + contact line, in the gap the rules leave above the divider.
  // A CR80 is a fixed canvas, so the block is measured first and skipped entirely
  // rather than allowed to collide with the rule below it.
  const cardContact = [
    contact.address,
    [contact.phone, contact.email].filter(Boolean).join('  •  '),
  ]
    .filter(Boolean)
    .map((t) => cleanText(t))
    .join('\n');
  if (cardContact) {
    const addrY = ry + 0.7 * MM;
    // Measured with the same options it is drawn with, so the guard cannot pass a
    // block that turns out taller than the estimate.
    const addrOpts = { width: CARD_W - 8 * MM, align: 'center' };
    doc.font('Helvetica').fontSize(4.4);
    const addrH = doc.heightOfString(cardContact, addrOpts);
    if (addrY + addrH <= dividerY - 1 * MM) {
      doc.fillColor(inkSoft).text(cardContact, 4 * MM, addrY, addrOpts);
    }
  }

  doc.moveTo(3 * MM, dividerY).lineTo(CARD_W - 3 * MM, dividerY).lineWidth(0.5).strokeColor(gold).stroke();

  // Issued date (left) and member ID (right) share a single row
  doc.font('Helvetica').fontSize(5.4).fillColor(inkSoft);
  doc.text(`Issued: ${formatDate(user.approvedAt)}`, 3 * MM, 37.6 * MM, { width: 42 * MM });
  doc.font('Helvetica-Bold').text(user.membershipId || '', CARD_W - 28 * MM, 37.6 * MM, {
    width: 25 * MM,
    align: 'right',
  });

  // ---- Secretary's signature ----
  // The club's stored Secretary signature is printed directly on the rule. With
  // no signature configured the rule simply stays empty, as it always has.
  await drawSignature(doc, (await getClubSignatures()).secretarySignatureUrl, {
    x: 5 * MM,
    y: 41.3 * MM,
    w: 43 * MM,
    h: 6.5 * MM,
  });

  doc.rect(3 * MM, 48.5 * MM, 47 * MM, 0.5 * MM).fillColor(gold).fill();
  doc.rect(CARD_W - 25 * MM, 48.5 * MM, 22 * MM, 0.5 * MM).fillColor(gold).fill();
  doc.font('Helvetica-Bold').fontSize(5).fillColor(inkSoft);
  doc.text('Authorised Signature', 3 * MM, 49.2 * MM, { width: 47 * MM, align: 'center' });
  doc.text('Secretary', CARD_W - 25 * MM, 49.2 * MM, { width: 22 * MM, align: 'center' });

  doc.end();
  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
  return file;
}

module.exports = { generateApplicationPdf, generateIdCardPdf, formatDate };