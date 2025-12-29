
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, query, getDocs, updateDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { UserProfile, ChatSession, Scheme, LockerDocument, Message } from '../types';

// NOTE: Production keys should be handled via environment variables.
const firebaseConfig = {
  apiKey: "AIzaSyCYH1XOln_TGU_dm4Ac2VF_5ZuKwq4vCM0",
  authDomain: "sahayak-ai-f5586.firebaseapp.com",
  projectId: "sahayak-ai-f5586",
  storageBucket: "sahayak-ai-f5586.firebasestorage.app",
  messagingSenderId: "1003208884256",
  appId: "1:1003208884256:web:a45685862e02079e847c45"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

/**
 * Syncs the user's profile information to Firestore.
 */
export const syncProfile = async (uid: string, profile: UserProfile) => {
  await setDoc(doc(db, 'users', uid), { profile }, { merge: true });
};

/**
 * Fetches the user profile from Firestore.
 */
export const fetchProfile = async (uid: string): Promise<UserProfile | null> => {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data().profile : null;
};

/**
 * Syncs multiple chat sessions/enquiries to the cloud.
 * Each session is stored as an individual document in the 'sessions' sub-collection.
 */
export const syncSessions = async (uid: string, sessions: ChatSession[]) => {
  const sessionCol = collection(db, 'users', uid, 'sessions');
  const batch = sessions.map(async (session) => {
    const sessionDoc = doc(sessionCol, session.id);
    return setDoc(sessionDoc, {
      id: session.id,
      title: session.title,
      lastModified: session.lastModified.toISOString(),
      messages: session.messages.map(m => {
        // Deep clone and handle non-serializable fields
        const serializedMsg: any = {
          ...m,
          timestamp: m.timestamp.toISOString(),
        };

        // Explicitly handle complex objects like docMetadata and schemes
        if (m.docMetadata) {
          serializedMsg.docMetadata = JSON.parse(JSON.stringify(m.docMetadata));
        }
        if (m.schemes) {
          serializedMsg.schemes = m.schemes.map(s => ({ ...s }));
        }

        return serializedMsg;
      })
    });
  });
  await Promise.all(batch);
};

/**
 * Deletes a specific enquiry session from the cloud.
 */
export const deleteSessionFromCloud = async (uid: string, sessionId: string) => {
  const sessionDoc = doc(db, 'users', uid, 'sessions', sessionId);
  await deleteDoc(sessionDoc);
};

/**
 * Fetches all saved enquiries for the logged-in user, ordered by most recent.
 */
export const fetchSessions = async (uid: string): Promise<ChatSession[]> => {
  try {
    const sessionCol = collection(db, 'users', uid, 'sessions');
    const q = query(sessionCol, orderBy('lastModified', 'desc'));
    const querySnapshot = await getDocs(q);
    
    const sessions: ChatSession[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      sessions.push({
        id: data.id,
        title: data.title,
        lastModified: new Date(data.lastModified),
        messages: (data.messages || []).map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        }))
      });
    });
    return sessions;
  } catch (error) {
    console.error("Error fetching enquiries:", error);
    return [];
  }
};

/**
 * Syncs bookmarks and locker documents.
 */
export const syncUserData = async (uid: string, data: { bookmarks: Scheme[], locker: LockerDocument[] }) => {
  await setDoc(doc(db, 'users', uid), { 
    bookmarks: data.bookmarks, 
    locker: data.locker 
  }, { merge: true });
};
