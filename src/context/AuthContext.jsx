import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, user: null, profile: null });
  const [error, setError] = useState('');

  useEffect(
    () =>
      onAuthStateChanged(auth, async (user) => {
        if (!user) {
          setState({ loading: false, user: null, profile: null });
          return;
        }
        try {
          const snap = await getDoc(doc(db, 'users', user.uid));
          if (!snap.exists()) {
            setError('Your login works, but there is no user profile for it. Ask the manager to add you under Users.');
            await signOut(auth);
            return;
          }
          const profile = { uid: user.uid, ...snap.data() };
          if (profile.active === false) {
            setError('This account is deactivated. Contact your manager.');
            await signOut(auth);
            return;
          }
          setError('');
          setState({ loading: false, user, profile });
          updateDoc(doc(db, 'users', user.uid), { lastLoginAt: serverTimestamp() }).catch(() => {});
        } catch (e) {
          setError(`Could not load your profile: ${e.message}`);
          await signOut(auth);
        }
      }),
    []
  );

  const value = {
    ...state,
    error,
    login: async (email, password) => {
      setError('');
      await signInWithEmailAndPassword(auth, email.trim(), password);
    },
    logout: () => signOut(auth),
    resetPassword: (email) => sendPasswordResetEmail(auth, email.trim()),
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
