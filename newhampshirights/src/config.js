const path = require('node:path');

const SECTIONS = [
  { slug: 'government', name: 'Government', blurb: 'State and town business: warrant articles, hearings, bills, budgets, meeting notes.' },
  { slug: 'marketplace', name: 'Marketplace', blurb: 'Buy, sell, and trade with verified neighbors. Local goods, services, and small business.' },
  { slug: 'discussion', name: 'Discussion', blurb: 'Talk it out. Civil debate on whatever Granite Staters care about.' },
  { slug: 'information', name: 'Information', blurb: 'Notices, public records, how-tos, and things worth knowing.' },
  { slug: 'help', name: 'Help', blurb: 'Ask for a hand or offer one. Rides, repairs, advice, lost and found.' },
  { slug: 'sharing', name: 'Sharing', blurb: 'Photos, stories, events, and the good stuff happening around the state.' },
];

// The ten New Hampshire counties.
const COUNTIES = [
  'Belknap', 'Carroll', 'Cheshire', 'Coös', 'Grafton',
  'Hillsborough', 'Merrimack', 'Rockingham', 'Strafford', 'Sullivan',
];

// Documents accepted for verification. A U.S. passport proves identity but
// carries no address, so it must be paired with proof of a New Hampshire address.
const DOC_TYPES = [
  { value: 'nh_driver_license', label: 'New Hampshire driver license', needsAddressProof: false },
  { value: 'nh_nondriver_id', label: 'New Hampshire non-driver ID card', needsAddressProof: false },
  { value: 'us_passport', label: 'U.S. passport or passport card (plus NH proof of address)', needsAddressProof: true },
];

function loadConfig(overrides = {}) {
  const dataDir = overrides.dataDir || process.env.DATA_DIR || path.join(__dirname, '..', 'data');
  return {
    siteName: process.env.SITE_NAME || 'NewHampshirights',
    domain: process.env.SITE_DOMAIN || 'newhampshirights.com',
    port: Number(process.env.PORT || 3000),
    production: process.env.NODE_ENV === 'production',
    dataDir,
    dbFile: path.join(dataDir, 'app.db'),
    privateUploadDir: path.join(dataDir, 'private', 'verification'),
    maxUploadBytes: 8 * 1024 * 1024,
    sessionDays: 30,
    ...overrides,
  };
}

module.exports = { SECTIONS, COUNTIES, DOC_TYPES, loadConfig };
