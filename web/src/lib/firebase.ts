import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getDatabase } from "firebase/database";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

export const firebaseConfig = {
  apiKey: "AIzaSyCqmvdBNOUDObtPrrQZub9g5XDNp5v9nFo",
  authDomain: "easyrecords-a016d.firebaseapp.com",
  databaseURL: "https://easyrecords-a016d-default-rtdb.firebaseio.com",
  projectId: "easyrecords-a016d",
  storageBucket: "easyrecords-a016d.firebasestorage.app",
  messagingSenderId: "97907093515",
  appId: "1:97907093515:web:a769312375cb1d164e170e",
  measurementId: "G-DLBL83BLLL"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const db = getDatabase(app);
export const firestore = getFirestore(app);
export const auth = getAuth(app);
