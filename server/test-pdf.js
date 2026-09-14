const { generateApplicationPdf } = require('./src/services/pdfService');
const fs = require('fs');

const sample = {
  _id: 'test-app-1',
  fullName: 'Arjun Krishnan',
  phoneNumber: '9847012345',
  membershipId: 'ALC-2026-0001',
  registrationNo: '12 BTY 6652',
  dob: new Date('1995-08-14'),
  age: 30,
  address: 'Malayil House, Kuppakolly P.O., Kuppakolly',
  occupation: 'Teacher',
  education: 'Post Graduate',
  recommender: { name: 'Ravi Pillai', memberId: 'ALC-2025-0102' },
  approvedBy: 'Secretary',
  approvedAt: new Date('2026-01-15'),
};

function countPages(pdfPath) {
  const buf = fs.readFileSync(pdfPath, 'utf8');
  const matches = buf.match(/\/Type\s*\/Page[^s]/g) || [];
  return matches.length;
}

(async () => {
  const file = await generateApplicationPdf(sample, {
    approvedBy: 'Secretary',
    approvedAt: new Date('2026-01-15'),
  });
  const pages = countPages(file);
  console.log('Generated:', file);
  console.log('Pages:', pages, pages === 1 ? 'PASS (single A4)' : 'FAIL');
})().catch((e) => { console.error(e); process.exit(1); });