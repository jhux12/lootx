import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBHYVrOGha0bJTyiGJ7Hcu0WInZRk2AoD8",
  authDomain: "hyperdrop-6476c.firebaseapp.com",
  databaseURL: "https://hyperdrop-6476c-default-rtdb.firebaseio.com",
  projectId: "hyperdrop-6476c",
  storageBucket: "hyperdrop-6476c.firebasestorage.app",
  messagingSenderId: "1059432373898",
  appId: "1:1059432373898:web:de58fa703fd903a9979773"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
export default app;
