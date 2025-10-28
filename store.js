/*
 * store.js (v4.11 - Removed Image Upload Feature)
 * Módulo de Lógica de Firestore y Storage.
 */

// REMOVIDO storage de la importación
import { db } from './firebase.js';
import {
    collection, getDocs, doc, updateDoc,
    writeBatch, setDoc, deleteDoc, Timestamp, query,
    orderBy, addDoc, getDoc, limit, collectionGroup,
    where, startAfter,
    documentId
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
// REMOVIDAS importaciones de firebase/storage
/*
import {
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-storage.js";
*/

// --- Constantes ---
const DIAS_COLLECTION = "Dias";
const MEMORIAS_COLLECTION = "Memorias";
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// --- 1. Lógica de Inicialización (Check/Repair) ---
// ... (checkAndRunApp, _generateCleanDatabase no cambian) ...

// --- 2. Lógica de Lectura (Días y Memorias) ---
// ... (loadAllDaysData, loadMemoriesForDay, getTodaySpotlight no cambian) ...

// --- 3. Lógica de Escritura (Días y Memorias) ---
// ... (saveDayName no cambia) ...

async function saveMemory(diaId, memoryData, memoryId) {
    const diaRef = doc(db, DIAS_COLLECTION, diaId);

    if (memoryData.Fecha_Original && !(memoryData.Fecha_Original instanceof Timestamp)) {
        memoryData.Fecha_Original = Timestamp.fromDate(memoryData.Fecha_Original);
    }

    // REMOVIDO -> delete memoryData.file; (ya no se pasa)

    delete memoryData.id; // Eliminar la propiedad 'id' interna si existe

    if (memoryId) { // Actualizar documento existente
        const memRef = doc(db, DIAS_COLLECTION, diaId, MEMORIAS_COLLECTION, memoryId);
        await updateDoc(memRef, memoryData);

    } else { // Añadir nuevo documento
        memoryData.Creado_En = Timestamp.now();
        const memRef = collection(db, DIAS_COLLECTION, diaId, MEMORIAS_COLLECTION);
        await addDoc(memRef, memoryData);
    }

    await updateDoc(diaRef, {
        tieneMemorias: true
    });
}


async function deleteMemory(diaId, memId, imagenURL) { // imagenURL ya no se usará pero se mantiene por firma

    // --- SECCIÓN DE BORRADO DE IMAGEN ELIMINADA ---
    /*
    if (imagenURL) {
        try {
            // const imageRef = ref(storage, imagenURL); // ref ya no importado
            // await deleteObject(imageRef); // deleteObject ya no importado
            console.log("Store: Imagen borrada de Storage:", imagenURL);
        } catch (error) {
            console.warn("Store: No se pudo borrar la imagen de Storage:", error.code);
        }
    }
    */

    // Borrar el documento de Firestore
    const memRef = doc(db, DIAS_COLLECTION, diaId, MEMORIAS_COLLECTION, memId);
    await deleteDoc(memRef);

    // Comprobar si quedan memorias en ese día
    const memoriasRef = collection(db, DIAS_COLLECTION, diaId, MEMORIAS_COLLECTION);
    const q = query(memoriasRef, limit(1));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        const diaRef = doc(db, DIAS_COLLECTION, diaId);
        await updateDoc(diaRef, {
            tieneMemorias: false
        });
    }
}

// --- FUNCIÓN uploadImage ELIMINADA ---
/*
async function uploadImage(file, userId, diaId) {
    // ... código eliminado ...
}
*/

// --- 4. Lógica de Búsqueda y "Almacén" ---
// ... (searchMemories, getMemoriesByType, getNamedDays no cambian) ...

// --- 5. Funciones de Ayuda (Helpers) ---
// ... (_formatStoreItem no cambia) ...

export {
    checkAndRunApp,
    loadAllDaysData,
    loadMemoriesForDay,
    saveDayName,
    saveMemory,
    deleteMemory,
    // REMOVIDO uploadImage de exportación
    searchMemories,
    getTodaySpotlight,
    getMemoriesByType,
    getNamedDays
};
