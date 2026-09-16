// UI copy for the landing experience. Brand placeholders (club name, place and
// established year) are injected from the master white-label config
// (src/config/clubConfig.js) so no tenant branding is hardcoded here.
import { clubConfig } from '../config/clubConfig';

const org = clubConfig.organization;

export const en = {
  nav: {
    welcome: 'Welcome',
    member: 'Member',
    myProfile: 'My Profile',
    adminPanel: 'Admin Panel',
    dashboard: 'Dashboard',
    logout: 'Logout',
    gallery: 'Gallery',
    becomeMember: 'Become a Member',
    login: 'Login',
  },
  footer: {
    tagline: `Empowering knowledge, culture, and sports in ${org.place} since ${org.establishedYear}.`,
    quickLinks: 'Quick Links',
    becomeMember: 'Become a Member',
    memberLogin: 'Member Login',
    bookCatalog: 'Book Catalog',
    upcomingEvents: 'Upcoming Events',
    contactUs: 'Contact Us',
    whatsappGroup: 'WhatsApp Group',
    findUsOnMaps: 'Find Us on Maps',
    aboutClub: 'About the Club',
    aboutText: `${org.fullName} is committed to fostering literacy, cultural exchange, and athletic development in the community. We welcome members of all ages who share a passion for learning and growth.`,
    rights: 'All rights reserved.',
  },
  hero: {
    rose: 'Rose of Memories',
    title1: 'Reading That',
    title2: 'Culture That',
    ignites: 'Ignites',
    unites: 'Unites',
    sub: `${org.fullName} — a home of 1000+ books, vibrant art, and a thriving sports spirit. Your journey of growth starts here.`,
    becomeMember: 'Become a Member',
    exploreCatalog: 'Explore Catalog',
  },
  stats: {
    booksInLibrary: 'Books in Library',
    activeMembers: 'Active Members',
    yearsOfService: 'Years of Service',
    pendingApplications: 'Pending Applications',
  },
  catalog: {
    ourLibrary: 'Our Library',
    popularBooks: 'Popular Books',
    membersBorrowFree: 'Members Borrow Free',
    loading: 'Loading catalog...',
  },
  events: {
    upcoming: 'Upcoming',
    title: 'Sports & Cultural Events',
  },
  gallery: {
    moments: 'Moments',
    title: 'Photo Gallery',
    viewAll: 'View All Albums',
    pageSub: 'A glimpse into the programmes, art & sports of our club — one album at a time.',
    noAlbums: 'No photo albums yet',
    noAlbumsSub: 'Photos from our programmes will appear here soon.',
    joinClub: 'Join the club',
  },
  cta: {
    title: 'Ready to join a community that grows together?',
    sub: 'Register with your mobile number, verify your OTP, and complete your application in under two minutes.',
    registerNow: 'Register Now',
    alreadyMember: "I'm already a member",
  },
  theme: {
    light: 'Switch to light mode',
    dark: 'Switch to dark mode',
  },
};

export const ml = {
  nav: {
    welcome: 'സ്വാഗതം',
    member: 'അംഗം',
    myProfile: 'എന്റെ പ്രൊഫൈൽ',
    adminPanel: 'അഡ്മിൻ പാനൽ',
    dashboard: 'ഡാഷ്ബോർഡ്',
    logout: 'ലോഗൗട്ട്',
    gallery: 'ഗാലറി',
    becomeMember: 'അംഗമാകൂ',
    login: 'ലോഗിൻ',
  },
  footer: {
    tagline: `${org.establishedYear} മുതൽ ${org.placeMalayalam}ിൽ വിജ്ഞാനവും സംസ്കാരവും കായികവും പരിപോഷിപ്പിക്കുന്നു.`,
    quickLinks: 'ദ്രുത കണ്ണികൾ',
    becomeMember: 'അംഗത്വം നേടുക',
    memberLogin: 'അംഗ ലോഗിൻ',
    bookCatalog: 'പുസ്തക കാറ്റലോഗ്',
    upcomingEvents: 'വരാനിരിക്കുന്ന പരിപാടികൾ',
    contactUs: 'ബന്ധപ്പെടുക',
    whatsappGroup: 'വാട്സ്ആപ്പ് ഗ്രൂപ്പ്',
    findUsOnMaps: 'മാപ്പിൽ കാണുക',
    aboutClub: 'ക്ലബ്ബിനെക്കുറിച്ച്',
    aboutText: `${org.nameMalayalam} സമൂഹത്തിൽ സാക്ഷരതയും സാംസ്കാരിക കൈമാറ്റവും കായിക വികസനവും വളർത്താൻ പ്രതിജ്ഞാബദ്ധമാണ്. പഠനത്തിലും വളർച്ചയിലും താൽപ്പര്യമുള്ള എല്ലാ പ്രായക്കാരെയും ഞങ്ങൾ സ്വാഗതം ചെയ്യുന്നു.`,
    rights: 'എല്ലാ അവകാശങ്ങളും നിക്ഷിപ്തം.',
  },
  hero: {
    rose: 'ഓർമ്മകളുടെ റോസ',
    title1: 'വായന',
    title2: 'സംസ്കാരം',
    ignites: 'ജ്വലിപ്പിക്കുന്നു',
    unites: 'ഒന്നിപ്പിക്കുന്നു',
    sub: `${org.nameMalayalam} — 1000+ പുസ്തകങ്ങളുടെ ഇരിപ്പിടം, ഊർജ്ജസ്വലമായ കല, കായികാവേശം. നിങ്ങളുടെ വളർച്ചാപാത ഇവിടെ തുടങ്ങുന്നു.`,
    becomeMember: 'അംഗമാകൂ',
    exploreCatalog: 'കാറ്റലോഗ് കാണുക',
  },
  stats: {
    booksInLibrary: 'ലൈബ്രറിയിലെ പുസ്തകങ്ങൾ',
    activeMembers: 'സജീവ അംഗങ്ങൾ',
    yearsOfService: 'സേവന വർഷങ്ങൾ',
    pendingApplications: 'തീർപ്പാക്കാനുള്ള അപേക്ഷകൾ',
  },
  catalog: {
    ourLibrary: 'ഞങ്ങളുടെ ലൈബ്രറി',
    popularBooks: 'പ്രശസ്ത പുസ്തകങ്ങൾ',
    membersBorrowFree: 'അംഗങ്ങൾക്ക് സൗജന്യ വായന',
    loading: 'കാറ്റലോഗ് ലോഡ് ചെയ്യുന്നു...',
  },
  events: {
    upcoming: 'വരുന്നത്',
    title: 'കായിക, സാംസ്കാരിക പരിപാടികൾ',
  },
  gallery: {
    moments: 'നിമിഷങ്ങൾ',
    title: 'ഫോട്ടോ ഗാലറി',
    viewAll: 'എല്ലാ ആൽബങ്ങളും കാണുക',
    pageSub: 'ഞങ്ങളുടെ ക്ലബ്ബിന്റെ പരിപാടികളുടെയും കലയുടെയും കായിക രംഗങ്ങളുടെയും ഒറ്റനോട്ടം — ഓരോ ആൽബവും ഒരു കഥ.',
    noAlbums: 'ഇതുവരെ ഫോട്ടോ ആൽബങ്ങളില്ല',
    noAlbumsSub: 'ഞങ്ങളുടെ പരിപാടികളിലെ ഫോട്ടോകൾ ഉടൻ ഇവിടെ ദൃശ്യമാകും.',
    joinClub: 'ഞങ്ങളിൽ ചേരൂ',
  },
  cta: {
    title: 'ഒന്നിച്ച് വളരുന്ന സമൂഹത്തിന്റെ ഭാഗമാകാൻ തയ്യാറാണോ?',
    sub: 'നിങ്ങളുടെ മൊബൈൽ നമ്പറിൽ രജിസ്റ്റർ ചെയ്യുക, OTP സ്ഥിരീകരിക്കുക, രണ്ട് മിനിറ്റിനുള്ളിൽ അപേക്ഷ പൂർത്തിയാക്കുക.',
    registerNow: 'ഇപ്പോൾ രജിസ്റ്റർ ചെയ്യുക',
    alreadyMember: 'ഞാൻ ഇതിനകം അംഗമാണ്',
  },
  theme: {
    light: 'ലൈറ്റ് മോഡിലേക്ക് മാറുക',
    dark: 'ഡാർക്ക് മോഡിലേക്ക് മാറുക',
  },
};