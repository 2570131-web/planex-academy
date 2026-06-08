// src/config/firebase.js
import admin from 'firebase-admin';
import { readFileSync } from 'fs';

export function initFirebase() {
  if (admin.apps.length) return;
  try {
    let credential;
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      credential = admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      credential = admin.credential.cert(JSON.parse(readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)));
    } else {
      credential = admin.credential.applicationDefault();
    }
    admin.initializeApp({ credential, projectId: process.env.FIREBASE_PROJECT_ID, storageBucket: process.env.FIREBASE_STORAGE_BUCKET });
    console.log('✅ Firebase Admin SDK initialized');
    seedDefaultSettings();
  } catch (e) {
    console.error('❌ Firebase init failed:', e.message);
    process.exit(1);
  }
}

export const getDb    = () => admin.firestore();
export const getAdmin = () => admin;
export const ts       = () => admin.firestore.FieldValue.serverTimestamp();
export const arrayUnion   = (...v) => admin.firestore.FieldValue.arrayUnion(...v);
export const arrayRemove  = (...v) => admin.firestore.FieldValue.arrayRemove(...v);
export const increment    = (n=1)  => admin.firestore.FieldValue.increment(n);

async function seedDefaultSettings() {
  try {
    const ref = getDb().collection('settings').doc('site');
    const doc = await ref.get();
    if (!doc.exists) {
      await ref.set({
        coachingName: 'Planex Academy',
        slogan: 'where plan takes you to the apex',
        address: 'Satsang Nagar Road No. 1, Rajabazar, Jehanabad',
        mobile: '8825144791',
        email: 'info@planexacademy.in',
        heroTitle: 'Unlock Your Academic Potential',
        heroSubtitle: 'Expert coaching for Classes 7–12 in Science, Math & Chemistry.',
        aboutText: "Planex Academy is Jehanabad's most trusted coaching institute, dedicated to student excellence through expert teaching and personalised guidance.",
        socialFacebook: '', socialInstagram: '', socialYoutube: '',
        mapsEmbedUrl: '',
        updatedAt: ts(),
      });
      console.log('✅ Default site settings seeded');
    }
  } catch (e) { console.warn('Settings seed skipped:', e.message); }
}
