// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration (updated to new project)
const firebaseConfig = {
  apiKey: "AIzaSyDEESiOGqEt0tXYxq6yUmmUwpEtMYZL9rI",
  authDomain: "gen-lang-client-0537348646.firebaseapp.com",
  projectId: "gen-lang-client-0537348646",
  storageBucket: "gen-lang-client-0537348646.firebasestorage.app",
  messagingSenderId: "888663079211",
  appId: "1:888663079211:web:79492d23c59b1247352d6e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Google Auth Provider
export const googleProvider = new GoogleAuthProvider();

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize Cloud Storage and get a reference to the service
export const storage = getStorage(app);