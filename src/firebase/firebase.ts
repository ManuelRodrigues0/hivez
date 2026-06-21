import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCf6Xc-f6FqIH4ArI_k05q2z_Qr0uOHE8U",
  authDomain: "hivez-21680.firebaseapp.com",
  projectId: "hivez-21680",
  storageBucket: "hivez-21680.firebasestorage.app",
  messagingSenderId: "18417332890",
  appId: "1:18417332890:web:8e17e703d0184ac2f92523",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const db = getFirestore(app);

export const googleProvider = new GoogleAuthProvider();