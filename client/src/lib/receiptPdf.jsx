import { createRoot } from 'react-dom/client';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import ReceiptVoucherDocument from '../components/ReceiptVoucherDocument';
import { clubContactReady } from './useClubContact';
import { clubSignaturesReady } from './useClubSignatures';

let container = null;
let root = null;

// A document captured before these resolve would print the white-label fallback
// contact details and an empty signature rule instead of the club's real ones, so
// the requests are awaited up front. The timeout keeps a slow or offline API from
// blocking the export — the fallbacks then apply, which is still a valid document.
const READY_TIMEOUT_MS = 2500;

async function mountDocument(voucher) {
  if (!container) {
    container = document.createElement('div');
    container.setAttribute('data-receipt-pdf-root', 'true');
    container.style.cssText = 'position:absolute;left:-10000px;top:0;width:794px;pointer-events:none;';
    document.body.appendChild(container);
    root = createRoot(container);
  }
  await Promise.race([
    Promise.all([clubContactReady(), clubSignaturesReady()]),
    new Promise((r) => setTimeout(r, READY_TIMEOUT_MS)),
  ]);
  root.render(<ReceiptVoucherDocument voucher={voucher} />);
  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch (e) {}
  }
  // Let the logo and signature images paint before capture.
  await new Promise((r) => setTimeout(r, 350));
  return container;
}

// Builds the A4 PDF (splitting tall documents across pages) from the exact
// ReceiptVoucherDocument template used for previews.
export async function buildReceiptPdf(voucher) {
  const host = await mountDocument(voucher);
  const canvas = await html2canvas(host.firstElementChild || host, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    allowTaint: false,
    logging: false,
  });

  const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgH = (canvas.height * pageW) / canvas.width;
  const img = canvas.toDataURL('image/jpeg', 0.95);

  let remaining = imgH;
  let offset = 0;
  let first = true;

  while (remaining > 0) {
    if (!first) pdf.addPage();
    const sliceH = Math.min(pageH - 24, imgH - offset);
    if (sliceH <= 0) break;
    const sy = (offset / imgH) * canvas.height;
    const sh = (sliceH / imgH) * canvas.height;
    const temp = document.createElement('canvas');
    temp.width = canvas.width;
    temp.height = sh;
    const ctx = temp.getContext('2d');
    ctx.drawImage(canvas, 0, sy, canvas.width, sh, 0, 0, temp.width, temp.height);
    pdf.addImage(temp.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 12, pageW, sliceH);
    remaining = imgH - (offset + sliceH);
    offset += sliceH;
    first = false;
  }
  return pdf;
}

export async function downloadReceiptPdf(voucher) {
  const pdf = await buildReceiptPdf(voucher);
  pdf.save(`${voucher.voucherNo || 'receipt'}.pdf`);
}

export async function printReceiptPdf(voucher) {
  const pdf = await buildReceiptPdf(voucher);
  pdf.autoPrint();
  const blob = pdf.output('blob');
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) win.focus();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}