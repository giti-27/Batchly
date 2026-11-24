import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";

export const firebaseConfig = {
  projectId: "limitless-c72be",
  appId: "1:197591495408:web:b03aeea36a0afe1e618835",
  storageBucket: "limitless-c72be.firebasestorage.app",
  apiKey: "AIzaSyAL_1f5TbxgcktSs3SLYBfIBl_5Jp7xMew",
  authDomain: "limitless-c72be.firebaseapp.com",
  messagingSenderId: "197591495408",
  measurementId: "G-63CJCDRG68"
};

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
