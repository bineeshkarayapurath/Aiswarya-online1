const { generateApplicationPdf } = require('./src/services/pdfService');
const fs = require('fs');

function countPages(pdfPath) {
  const buf = fs.readFileSync(pdfPath, 'utf8');
  return (buf.match(/\/Type\s*\/Page[^s]/g) || []).length;
}

(async () => {
  const longAddress =
    'Malayil House, Vadakkeveed, near Kuppakolly Grama Panchayat Office, Kuppakolly P.O., ' +
    'Kozhikode District, Kerala 673007, India';
  const file = await generateApplicationPdf(
    {
      _id: 'long-addr-1',
      fullName: 'Very Long Name Example Person',
      phoneNumber: '9847012345',
      membershipId: 'ALC-2026-9999',
      dob: new Date('1960-05-05'),
      age: 66,
      address: longAddress,
      occupation: 'Self-Employed / Business',
      education: 'Others',
      recommender: { name: 'A Very Long Recommender Name Indeed', memberId: 'ALC-2025-9998' },
    },
    { approvedBy: 'President', approvedAt: new Date('2026-02-20') }
  );
  console.log('Long-address pages:', countPages(file), countPages(file) === 1 ? 'PASS' : 'FAIL');
})().catch((e) => { console.error(e); process.exit(1); });