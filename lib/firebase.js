import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  getRedirectResult,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "mock-key-for-build",
  authDomain: "fabrica-foodie.firebaseapp.com",
  projectId: "fabrica-foodie",
  storageBucket: "fabrica-foodie.firebasestorage.app",
  messagingSenderId: "635499185101",
  appId: "1:635499185101:web:e5b4dcba1c57e782467a84",
  measurementId: "G-MPYBH4KBER"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

let _googleRedirectResultPromise = null;
export const consumeGoogleRedirectResult = () => {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (!_googleRedirectResultPromise) {
    _googleRedirectResultPromise = getRedirectResult(auth);
  }
  return _googleRedirectResultPromise;
};

export const APP_ID = 'fabrica-foodie-app';
export const FABRICA_THREADS_HANDLE = '@fabrica_tw';
export const createVerificationCode = () => `FAB-${Math.floor(1000 + Math.random() * 9000)}`;
