import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDnleEFt4HuD2uYInZKNsbZsy-9hW1XFmI",
  authDomain: "snapme-database.firebaseapp.com",
  projectId: "snapme-database",
  storageBucket: "snapme-database.firebasestorage.app",
  messagingSenderId: "695044270181",
  appId: "1:695044270181:web:1929b368b0b32d3d70be8c",
  measurementId: "G-3PW93Q6ZPD"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "default");
const auth = getAuth(app);
const storage = getStorage(app);

export { db, auth, storage, app };
