import clubConfig from '../config/clubConfig';
import { rupeesToWords } from '../lib/amountWords';

const org = clubConfig.organization;
const brand = clubConfig.branding;
const theme = clubConfig.themeColors;

const DARK = theme.primary[900];
const GOLD = theme.accent.DEFAULT;
const INK = theme.pdf.ink || '#0f172a';
const GREY = theme.pdf.grey || '#475569';
const CREAM = theme.pdf.cream || '#fdf6e6';

const fmtMoney = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '—');
const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—');

const rule = { borderTop: `1px solid ${GOLD}` };
const labelStyle = { fontSize: 10, color: GREY, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 };
const valueStyle = { fontSize: 13, color: INK, fontWeight: 700 };

// The single official voucher/receipt template. Used for live previews and for
// PDF export (html2canvas) so Member and Admin views are pixel-identical.
export default function ReceiptVoucherDocument({ voucher, qrImage }) {
  const isReceipt = voucher?.type === 'RECEIPT';
  const title = isReceipt ? 'Receipt' : 'Voucher';

  return (
    <div
      id="receipt-document"
      style={{
        width: 794,
        boxSizing: 'border-box',
        background: '#fff',
        color: INK,
        fontFamily: "'Plus Jakarta Sans','Manrope','Noto Sans Malayalam',system-ui,sans-serif",
      }}
    >
      {/* Branded header */}
      <div style={{ background: DARK, padding: '20px 28px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <img src={brand.logo} alt={org.shortName} style={{ width: 64, height: 64, objectFit: 'contain', flexShrink: 0 }} />
        <div style={{ flex: 1, color: '#fff' }}>
          <div style={{ fontSize: 19, fontWeight: 900, lineHeight: 1.2 }}>{org.fullName}</div>
          <div style={{ fontSize: 11, color: theme.primary[100], marginTop: 2 }}>{brand.tagline}</div>
          <div style={{ fontSize: 10, color: theme.accent[300] || GOLD, marginTop: 3, fontWeight: 700 }}>
            Reg No: {org.regNo}
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 10, color: theme.primary[100], lineHeight: 1.6 }}>
          <div>{org.address}</div>
          <div>{org.phone}</div>
          <div>{org.email}</div>
        </div>
      </div>
      <div style={{ height: 3, background: GOLD }} />

      {/* Title row */}
      <div style={{ padding: '18px 28px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1, color: DARK }}>
            {title}
          </div>
          <div style={{ fontSize: 10, color: GREY, marginTop: 2 }}>
            Generated on {fmtDate(voucher?.createdAt || voucher?.date)} at {fmtTime(voucher?.createdAt)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: GREY, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {isReceipt ? 'Receipt No' : 'Voucher No'}
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: GOLD }}>{voucher?.voucherNo}</div>
        </div>
      </div>
      <div style={{ margin: '14px 28px 0', ...rule }} />

      {/* Party */}
      <div style={{ padding: '16px 28px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <div style={labelStyle}>Received From / Party</div>
          <div style={{ ...valueStyle, fontSize: 15 }}>{voucher?.partyName || '—'}</div>
          {voucher?.memberId && (
            <div style={{ fontSize: 11, color: GREY, marginTop: 2 }}>Member ID: {voucher.memberId}</div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={labelStyle}>Phone</div>
          <div style={valueStyle}>{voucher?.phone || '—'}</div>
        </div>
      </div>

      {/* Details */}
      <div style={{ margin: '14px 28px 0', border: `1px solid #e2e8f0`, borderRadius: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ padding: '10px 14px', borderRight: '1px solid #e2e8f0' }}>
            <div style={labelStyle}>Category</div>
            <div style={valueStyle}>{voucher?.category || 'General'}</div>
          </div>
          <div style={{ padding: '10px 14px' }}>
            <div style={labelStyle}>Payment Mode</div>
            <div style={valueStyle}>{(voucher?.paymentMode || 'CASH').replace(/_/g, ' ')}</div>
          </div>
        </div>
        <div style={{ padding: '10px 14px', background: CREAM, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
          <div>
            <div style={labelStyle}>Amount {isReceipt ? 'Received' : 'Paid'}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: DARK }}>{fmtMoney(voucher?.amount)}</div>
          </div>
          <div style={{ textAlign: 'right', maxWidth: 320 }}>
            <div style={labelStyle}>In Words</div>
            <div style={{ fontSize: 11, color: INK, fontWeight: 600 }}>{rupeesToWords(voucher?.amount)}</div>
          </div>
        </div>
        {qrImage && (
          <div style={{ padding: '10px 14px', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src={qrImage} alt="verify" style={{ width: 56, height: 56 }} />
            <div style={{ fontSize: 10, color: GREY }}>Scan to verify authenticity of this {title.toLowerCase()}</div>
          </div>
        )}
      </div>

      {/* Remarks */}
      {voucher?.remarks && (
        <div style={{ padding: '12px 28px 0' }}>
          <div style={labelStyle}>Remarks</div>
          <div style={{ fontSize: 12, color: INK }}>{voucher.remarks}</div>
        </div>
      )}

      {/* Signatory */}
      <div style={{ padding: '34px 28px 18px', display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ textAlign: 'center', width: 180 }}>
          <div style={{ marginBottom: 36, fontSize: 11, color: GREY }}>Cashier / Authorised Person</div>
          <div style={{ borderTop: `1px solid ${INK}`, paddingTop: 6, fontSize: 10, fontWeight: 700, color: INK }}>Signature</div>
        </div>
        <div style={{ textAlign: 'center', width: 180 }}>
          <div style={{ marginBottom: 36, fontSize: 11, color: GREY }}>For {org.shortName}</div>
          <div style={{ borderTop: `1px solid ${INK}`, paddingTop: 6, fontSize: 10, fontWeight: 700, color: INK }}>Authorised Signatory</div>
        </div>
      </div>

      <div style={{ borderTop: `2px solid ${GOLD}`, padding: '8px 28px', textAlign: 'center', fontSize: 9, color: GREY }}>
        This is a computer-generated {title.toLowerCase()}. {org.fullName} · Since {org.establishedYear}
      </div>
      <div style={{ background: DARK, height: 6 }} />
    </div>
  );
}