import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyB4lYMnm7e01XjoXVD1w2z_6eWqtQRZ2JY",
    authDomain: "gestorde-obras.firebaseapp.com",
    projectId: "gestorde-obras",
    storageBucket: "gestorde-obras.firebasestorage.app",
    messagingSenderId: "1087144807634",
    appId: "1:1087144807634:web:30cbf8ad83a33d7e7b710b",
    measurementId: "G-MW6FVJFDW5"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
