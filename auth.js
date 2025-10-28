/*
 * auth.js (v4.9 - Con checkAuthState)
 * Módulo para gestionar la autenticación de Firebase
 */

import { auth } from './firebase.js';
import {
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

let authChangeCallback = null;

/**
 * Inicializa el listener de cambio de estado de autenticación.
 * @param {function} onAuthChangeCallback - Función a la que llamar cuando el usuario cambia (recibe el objeto 'user')
 */
export function initAuthListener(onAuthChangeCallback) {
    // Guardamos el callback para usarlo también en checkAuthState
    authChangeCallback = onAuthChangeCallback;
    onAuthStateChanged(auth, onAuthChangeCallback);
}

/**
 * NUEVO: Devuelve una promesa que se resuelve con el estado de auth inicial.
 * Esto evita la "race condition" al arrancar la app.
 * @returns {Promise<object|null>}
 */
export function checkAuthState() {
    return new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            unsubscribe(); // Nos desuscribimos para no llamarlo dos veces
            if (authChangeCallback) {
                authChangeCallback(user); // Llamamos al listener normal
            }
            resolve(user); // Resolvemos la promesa
        }, (error) => {
            // En caso de error en la comprobación inicial
            console.error("Error en checkAuthState:", error);
            resolve(null); // Resolvemos como null para que la app pueda continuar
        });
    });
}


/**
 * Inicia el proceso de login con Google.
 */
export async function handleLogin() {
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Google Sign-In Error:", error);
        // Lanzamos el error para que main.js lo atrape
        throw error;
    }
}

/**
 * Cierra la sesión del usuario.
 */
export async function handleLogout() {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Sign-out Error:", error);
        // Lanzamos el error para que main.js lo atrape
        throw error;
    }
}

