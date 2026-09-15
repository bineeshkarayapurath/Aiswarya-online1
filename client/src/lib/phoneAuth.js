// Firebase Phone Authentication — loaded lazily so the app keeps working
// (falling back to the server OTP flow) until VITE_FIREBASE_* values
// are added to client/.env.

const env = () => import.meta.env;

export const isFirebaseConfigured = () =>
  Boolean(
    env().VITE_FIREBASE_API_KEY &&
      env().VITE_FIREBASE_AUTH_DOMAIN &&
      env().VITE_FIREBASE_PROJECT_ID
  );

let fb = null;

async function load() {
  if (fb) return fb;
  const [{ initializeApp }, { getAuth, signInWithPhoneNumber, RecaptchaVerifier }] =
    await Promise.all([import('firebase/app'), import('firebase/auth')]);
  const app = initializeApp({
    apiKey: env().VITE_FIREBASE_API_KEY,
    authDomain: env().VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env().VITE_FIREBASE_PROJECT_ID,
    messagingSenderId: env().VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env().VITE_FIREBASE_APP_ID,
  });
  const auth = getAuth(app);
  fb = { auth, signInWithPhoneNumber, RecaptchaVerifier };
  return fb;
}

// phone must be E.164, e.g. "+919876543210". Returns the Firebase
// confirmationResult ("verificationId") used by confirmFirebaseOtp().
export async function startFirebasePhoneVerification(phone, containerId) {
  const { auth, signInWithPhoneNumber, RecaptchaVerifier } = await load();
  const verifier = new RecaptchaVerifier(auth, containerId, { size: 'invisible' });
  return signInWithPhoneNumber(auth, phone, verifier);
}

export async function confirmFirebaseOtp(confirmationResult, code) {
  const result = await confirmationResult.confirm(String(code).trim());
  return { firebaseUid: result.user.uid };
}

export function firebaseErrorMessage(err, fallback = 'SMS verification failed. Try again.') {
  const map = {
    'auth/invalid-phone-number': 'Invalid phone number. Enter your 10-digit mobile number.',
    'auth/missing-verification-code': 'Enter the 6-digit code sent via SMS.',
    'auth/invalid-verification-code': 'Incorrect code. Please re-check the SMS.',
    'auth/code-expired': 'That code is expired. Resend a new one.',
    'auth/too-many-requests': 'Too many requests. Wait a moment and try again.',
    'auth/quota-exceeded': 'SMS quota reached. Try again later or submit without OTP.',
    'auth/operation-not-allowed': 'SMS phone verification is not enabled for this app yet.',
    'auth/captcha-check-failed': 'Robot check failed. Reload the page and try again.',
  };
  const code = err?.code || err?.message || '';
  return map[code] || (err?.message?.length > 2 ? err.message : fallback);
}