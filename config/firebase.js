import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js"; // 🔥 NOVO

const firebaseConfig = {
  apiKey: "AIzaSyBBMEsHQuB_FAZqL7xbnk3Zx8uDBpZOyus",
  authDomain: "catalogo-de-produtos-18ac0.firebaseapp.com",
  projectId: "catalogo-de-produtos-18ac0",
  storageBucket: "catalogo-de-produtos-18ac0.firebasestorage.app",
  messagingSenderId: "754123239831",
  appId: "1:754123239831:web:1a092ef71c1ee920b1d4d2",
  measurementId: "G-Q08503FXHW"
};

// 🔥 Inicializa
const app = initializeApp(firebaseConfig);

// 🔥 Serviços
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app); // Autenticação segura!

// 🔥 Exporta tudo
export { db, storage, auth }; // Autenticação segura!