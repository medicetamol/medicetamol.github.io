import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Firebase web config — safe to keep public; access is controlled by
// Firestore security rules, not by hiding this key.
const firebaseConfig = {
  apiKey: "AIzaSyAtREmlBeG6GNWXja2KxlYkk-iOlhnf33A",
  authDomain: "medicetamol-pyq.firebaseapp.com",
  projectId: "medicetamol-pyq",
  storageBucket: "medicetamol-pyq.firebasestorage.app",
  messagingSenderId: "401869093538",
  appId: "1:401869093538:web:c03e8e4bc8bd76f0bfb5fb",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
