import { doc, getDoc } from 'firebase/firestore';
import {
  auth,
  db,
  signInWithEmailAndPassword,
  signOut,
} from '../firebase';

export interface AdminProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: 'admin';
}

export async function signInAdmin(email: string, password: string): Promise<AdminProfile> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const profileSnapshot = await getDoc(doc(db, 'userProfiles', credential.user.uid));
  const profile = profileSnapshot.exists() ? profileSnapshot.data() : null;

  if (profile?.role !== 'admin') {
    await signOut(auth);
    const error = new Error('This account is not authorized for administrator access.');
    (error as Error & { code?: string }).code = 'auth/not-admin';
    throw error;
  }

  return {
    uid: credential.user.uid,
    email: credential.user.email,
    displayName: credential.user.displayName || profile.displayName || null,
    role: 'admin',
  };
}

export async function getCurrentAdmin(): Promise<AdminProfile | null> {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return null;

  const profileSnapshot = await getDoc(doc(db, 'userProfiles', user.uid));
  if (!profileSnapshot.exists() || profileSnapshot.data()?.role !== 'admin') {
    return null;
  }

  const profile = profileSnapshot.data();
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName || profile.displayName || null,
    role: 'admin',
  };
}

export async function signOutAdmin(): Promise<void> {
  await signOut(auth);
}
