const config = require('../config/constants');
const ClubSettings = require('../models/ClubSettings');
const User = require('../models/User');

// ============================================================================
//  Club contact resolver — the single definition of the club's official
//  address, email, phone and office-bearer phone numbers.
//
//  The website footer, the application letterhead, the ID cards, receipts and
//  vouchers all read the object returned here instead of each keeping its own
//  hardcoded copy, so a change made once in the admin settings screen reaches
//  every surface at once.
//
//  Resolution order:
//    address / phone / email -> ClubSettings, falling back to config.CLUB, so a
//                               document still prints the right details when the
//                               settings row has not been filled in yet.
//    officer phones          -> the number published in ClubSettings when one is
//                               set, otherwise the phoneNumber on the member
//                               account currently holding that post. That is what
//                               makes an election of a new President or Secretary
//                               show up everywhere on its own.
//
//  Every lookup is best-effort: a document must still generate if the database is
//  unhappy, so failures degrade to the config.CLUB fallback rather than throwing.
// ============================================================================

const OFFICERS = [
  { prefix: 'president', designation: 'President' },
  { prefix: 'secretary', designation: 'Secretary' },
];

async function getClubContact() {
  const out = {
    address: config.CLUB.address,
    phone: config.CLUB.phone,
    email: config.CLUB.email,
    presidentName: '',
    presidentPhone: '',
    presidentPhoneFromAccount: false,
    secretaryName: '',
    secretaryPhone: '',
    secretaryPhoneFromAccount: false,
  };

  let doc = null;
  try {
    doc = await ClubSettings.findOne({ key: 'default' }).lean();
  } catch (e) {
    console.warn(`[clubContact] settings lookup failed: ${e.message}`);
  }

  const stored = (field) => String((doc && doc[field]) || '').trim();
  out.address = stored('address') || out.address;
  out.phone = stored('phoneNumber') || out.phone;
  out.email = stored('emailAddress') || out.email;

  OFFICERS.forEach(({ prefix }) => {
    const published = stored(`${prefix}Phone`);
    out[`${prefix}Phone`] = published;
    out[`${prefix}PhoneFromAccount`] = !published;
  });

  try {
    const officers = await User.find({
      designation: { $in: OFFICERS.map((o) => o.designation) },
      status: config.STATUS.APPROVED,
    })
      .select('fullName designation phoneNumber')
      .lean();

    officers.forEach((o) => {
      const match = OFFICERS.find((x) => x.designation === o.designation);
      if (!match) return;
      if (!out[`${match.prefix}Name`]) out[`${match.prefix}Name`] = o.fullName || '';
      if (out[`${match.prefix}PhoneFromAccount`] && !out[`${match.prefix}Phone`]) {
        out[`${match.prefix}Phone`] = o.phoneNumber || '';
      }
    });
  } catch (e) {
    console.warn(`[clubContact] officer lookup failed: ${e.message}`);
  }

  return out;
}

module.exports = { getClubContact };
