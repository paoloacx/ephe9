/* firebase.js */
/* Este módulo se encarga de inicializar Firebase y exportar las instancias */

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-storage.js";

// --- Firebase Config ---
const firebaseConfig = {
  apiKey: "AIzaSyBrd-8qaBfSplBjj74MNuKP8UWYmr8RaJA",
  authDomain: "ephemerides-2005.firebaseapp.com",
  projectId: "ephemerides-2005",
  storageBucket: "ephemerides-2005.appspot.com", 
  messagingSenderId: "360961314777",
  appId: "1:360961314777:web:809d9e66535acb292d13c8",
  measurementId: "G-BZC9FRYCJW"
};

// --- Inicialización ---
let app;
try {
    app = initializeApp(firebaseConfig);
} catch (e) {
    console.error("Error inicializando Firebase:", e);
}


// --- Exportaciones ---
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

/**
 * Función de inicialización (ahora solo confirma).
 */
export function initFirebase() {
    if (app) {
        console.log("Firebase inicializado correctamente.");
    } else {
        console.error("Firebase NO se pudo inicializar.");
    }
}
// (La llave extra que estaba aquí se ha borrado)
