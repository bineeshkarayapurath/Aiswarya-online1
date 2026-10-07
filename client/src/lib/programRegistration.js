// Fallback category list, mirroring server constants PROGRAM_CATEGORIES. The
// live list comes from GET /api/registrations/config so the two can never drift
// for long; this keeps the form usable before/if that request fails.
export const DEFAULT_PROGRAM_CATEGORIES = [
  'Bharatanatyam',
  'Group Dance',
  'Drama',
  'Group Events',
  'Music / Singing',
  'Mimicry',
  'Quiz',
  'Elocution',
  'Sports',
  'Others',
];
