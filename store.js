/*
 * store.js (v4.11.1 - Corrected export block)
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

// --- Constantes ---
const DIAS_COLLECTION = "Dias";
const MEMORIAS_COLLECTION = "Memorias";
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// --- 1. Lógica de Inicialización (Check/Repair) ---

async function checkAndRunApp(onProgress) { // <-- DEFINICIÓN ESTÁ AQUÍ
    console.log("Store: Verificando base de datos...");
    const diasRef = collection(db, DIAS_COLLECTION);

    try {
        const checkDoc = await getDoc(doc(db, DIAS_COLLECTION, "01-01"));

        if (!checkDoc.exists()) {
             console.warn("Store: El día 01-01 no existe. Regenerando base de datos...");
             await _generateCleanDatabase(onProgress);
        } else {
             console.log("Store: Base de datos verificada (01-01 existe).");
        }
    } catch (e) {
         console.error("Error al verificar la base de datos (puede ser por permisos o doc no existe):", e);
         try {
            await _generateCleanDatabase(onProgress);
         } catch (genError) {
            console.error("Store: Fallo crítico al regenerar la base de datos.", genError);
            throw genError;
         }
    }
}

async function _generateCleanDatabase(onProgress) {
    const diasRef = collection(db, DIAS_COLLECTION);

    try {
        onProgress("Borrando datos antiguos...");
        console.log("Store: Borrando 'Dias'...");
        const oldDocsSnapshot = await getDocs(diasRef);

        if (!oldDocsSnapshot.empty) {
            let batch = writeBatch(db);
            let deleteCount = 0;
            oldDocsSnapshot.forEach((docSnap) => { // Usar forEach para simplicidad si no hay await dentro
                if (docSnap.id.length === 5 && docSnap.id.includes('-')) {
                    batch.delete(docSnap.ref);
                    deleteCount++;
                    // Dividir el batch si es muy grande (Firebase recomienda < 500 ops)
                    if (deleteCount >= 400) {
                         batch.commit().then(() => { // Commit asíncrono, reiniciar batch
                             batch = writeBatch(db);
                             deleteCount = 0;
                         }).catch(err => console.error("Error en commit intermedio del batch delete:", err));
                    }
                }
            });
            // Commit final del batch si queda algo
             if (deleteCount > 0) {
                 await batch.commit(); // Esperar al último commit
             }
            console.log(`Store: Borrado completo (${oldDocsSnapshot.size} días evaluados).`);
        } else {
            console.log("Store: La colección 'Dias' ya estaba vacía.");
        }
    } catch (e) {
        console.error("Store: Error borrando colección (posiblemente reglas de Firestore):", e);
    }

    console.log("Store: Generando 366 días limpios...");
    onProgress("Generando 366 días limpios...");
    let genBatch = writeBatch(db);
    let ops = 0;
    let created = 0;

    try {
        for (let m = 0; m < 12; m++) {
            const monthNum = m + 1;
            const monthStr = monthNum.toString().padStart(2, '0');
            const numDays = DAYS_IN_MONTH[m];

            for (let d = 1; d <= numDays; d++) {
                const dayStr = d.toString().padStart(2, '0');
                const diaId = `${monthStr}-${dayStr}`;

                const diaData = {
                    Nombre_Dia: `${d} de ${MONTH_NAMES[m]}`,
                    Icono: '',
                    Nombre_Especial: "Unnamed Day",
                    tieneMemorias: false
                };

                const docRef = doc(db, DIAS_COLLECTION, diaId);
                genBatch.set(docRef, diaData);
                ops++;
                created++;

                if (created % 50 === 0) {
                    onProgress(`Generando ${created}/366...`);
                }
                if (ops >= 400) {
                    await genBatch.commit();
                    genBatch = writeBatch(db);
                    ops = 0;
                }
            }
        }
        if (ops > 0) {
            await genBatch.commit();
        }
        console.log(`Store: Regeneración completa: ${created} días creados.`);
        onProgress(`Base de datos regenerada: ${created} días.`);
    } catch (e) {
        console.error("Store: Error generando días (posiblemente reglas de Firestore):", e);
        throw e;
    }
}

// --- 2. Lógica de Lectura (Días y Memorias) ---

async function loadAllDaysData() {
    const q = query(collection(db, DIAS_COLLECTION), orderBy(documentId()));
    const querySnapshot = await getDocs(q);
    const allDays = [];
    querySnapshot.forEach((doc) => {
        if (doc.id.length === 5 && doc.id.includes('-')) {
            allDays.push({ id: doc.id, ...doc.data() });
        }
    });
    console.log(`Store: Cargados ${allDays.length} días.`);
    return allDays;
}

async function loadMemoriesForDay(diaId) {
    const memoriasRef = collection(db, DIAS_COLLECTION, diaId, MEMORIAS_COLLECTION);
    const q = query(memoriasRef, orderBy("Fecha_Original", "desc"));
    const querySnapshot = await getDocs(q);
    const memories = [];
    querySnapshot.forEach((doc) => {
        memories.push({ id: doc.id, ...doc.data() });
    });
    return memories;
}

async function getTodaySpotlight(todayId) {
    try {
        const diaRef = doc(db, DIAS_COLLECTION, todayId);
        const diaSnap = await getDoc(diaRef);
        const dayName = diaSnap.exists() ? (diaSnap.data().Nombre_Especial || 'Unnamed Day') : 'Unnamed Day';

        const memoriasRef = collection(db, DIAS_COLLECTION, todayId, MEMORIAS_COLLECTION);
        const q = query(memoriasRef, orderBy("Fecha_Original", "desc"), limit(3));
        const memSnapshot = await getDocs(q);
        const memories = [];
        memSnapshot.forEach(doc => {
            memories.push({ id: doc.id, diaId: todayId, ...doc.data() });
        });
        return { dayName, memories };
    } catch (err) {
        console.error("Store: Error cargando spotlight:", err);
        return { dayName: 'Error al cargar', memories: [] };
    }
}

// --- 3. Lógica de Escritura (Días y Memorias) ---

async function saveDayName(diaId, newName) {
    const diaRef = doc(db, DIAS_COLLECTION, diaId);
    const finalName = newName && newName.trim() !== '' ? newName.trim() : "Unnamed Day";
    await updateDoc(diaRef, { Nombre_Especial: finalName });
}

async function saveMemory(diaId, memoryData, memoryId) {
    const diaRef = doc(db, DIAS_COLLECTION, diaId);
    if (memoryData.Fecha_Original && !(memoryData.Fecha_Original instanceof Timestamp)) {
        memoryData.Fecha_Original = Timestamp.fromDate(memoryData.Fecha_Original);
    }
    delete memoryData.id; // Asegurarse de quitar el id interno

    if (memoryId) {
        const memRef = doc(db, DIAS_COLLECTION, diaId, MEMORIAS_COLLECTION, memoryId);
        await updateDoc(memRef, memoryData);
    } else {
        memoryData.Creado_En = Timestamp.now();
        const memRef = collection(db, DIAS_COLLECTION, diaId, MEMORIAS_COLLECTION);
        await addDoc(memRef, memoryData);
    }
    await updateDoc(diaRef, { tieneMemorias: true });
}

async function deleteMemory(diaId, memId, imagenURL) { // imagenURL ya no se usa
    const memRef = doc(db, DIAS_COLLECTION, diaId, MEMORIAS_COLLECTION, memId);
    await deleteDoc(memRef);

    const memoriasRef = collection(db, DIAS_COLLECTION, diaId, MEMORIAS_COLLECTION);
    const q = query(memoriasRef, limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        const diaRef = doc(db, DIAS_COLLECTION, diaId);
        await updateDoc(diaRef, { tieneMemorias: false });
    }
}

// --- FUNCIÓN uploadImage ELIMINADA ---

// --- 4. Lógica de Búsqueda y "Almacén" ---

async function searchMemories(term) {
    const diasConMemoriasQuery = query(collection(db, DIAS_COLLECTION), where("tieneMemorias", "==", true));
    const diasSnapshot = await getDocs(diasConMemoriasQuery);
    let results = [];
    const searchPromises = [];
    diasSnapshot.forEach(diaDoc => {
        const diaId = diaDoc.id;
        if (diaId.length !== 5 || !diaId.includes('-')) return;
        const p = (async () => {
            const memoriasRef = collection(db, DIAS_COLLECTION, diaId, MEMORIAS_COLLECTION);
            const memSnapshot = await getDocs(memoriasRef);
            memSnapshot.forEach(memDoc => {
                const memoria = { id: memDoc.id, diaId: diaId, Nombre_Dia: diaDoc.data().Nombre_Dia, ...memDoc.data() };
                let searchableText = (memoria.Descripcion || '').toLowerCase() + ' ' + (memoria.LugarNombre || '').toLowerCase() + ' ' + (memoria.CancionInfo || '').toLowerCase();
                if (searchableText.includes(term)) {
                    results.push(memoria);
                }
            });
        })();
        searchPromises.push(p);
    });
    await Promise.all(searchPromises);
    results.sort((a, b) => (b.Fecha_Original?.toMillis() || 0) - (a.Fecha_Original?.toMillis() || 0));
    return results;
}

async function getMemoriesByType(type, pageSize = 10, lastVisibleDoc = null) {
    const memoriasGroupRef = collectionGroup(db, MEMORIAS_COLLECTION);
    let q;
    const constraints = [where("Tipo", "==", type), orderBy("Fecha_Original", "desc"), limit(pageSize)];
    if (lastVisibleDoc) {
        constraints.splice(2, 0, startAfter(lastVisibleDoc)); // Insertar startAfter antes del limit
    }
    q = query(memoriasGroupRef, ...constraints);

    const querySnapshot = await getDocs(q);
    const items = [];
    querySnapshot.forEach(docSnap => { // Usar forEach es más simple aquí
        const diaId = docSnap.ref.parent.parent.id;
        items.push(_formatStoreItem(docSnap, diaId));
    });

    const lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
    let hasMore = false;
    if (lastVisible) {
        const nextQuery = query(memoriasGroupRef, where("Tipo", "==", type), orderBy("Fecha_Original", "desc"), startAfter(lastVisible), limit(1));
        const nextSnapshot = await getDocs(nextQuery);
        hasMore = !nextSnapshot.empty;
    }
    return { items, lastVisible, hasMore };
}

async function getNamedDays(pageSize = 10, lastVisibleDoc = null) {
    const diasRef = collection(db, DIAS_COLLECTION);
    let q;
    const constraints = [where("Nombre_Especial", "!=", "Unnamed Day"), orderBy("Nombre_Especial", "asc"), limit(pageSize)];
     if (lastVisibleDoc) {
        constraints.splice(2, 0, startAfter(lastVisibleDoc));
     }
    q = query(diasRef, ...constraints);

    const querySnapshot = await getDocs(q);
    const items = [];
    querySnapshot.forEach(doc => {
        items.push(_formatStoreItem(doc, doc.id, true));
    });

    const lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
    let hasMore = false;
    if (lastVisible) {
        const nextQuery = query(diasRef, where("Nombre_Especial", "!=", "Unnamed Day"), orderBy("Nombre_Especial", "asc"), startAfter(lastVisible), limit(1));
        const nextSnapshot = await getDocs(nextQuery);
        hasMore = !nextSnapshot.empty;
    }
    return { items, lastVisible, hasMore };
}

// --- 5. Funciones de Ayuda (Helpers) ---

function _formatStoreItem(docSnap, diaId, isDay = false) {
    const data = docSnap.data();
    if (isDay) {
        return { id: docSnap.id, diaId: docSnap.id, type: 'Nombres', Nombre_Dia: data.Nombre_Dia, Nombre_Especial: data.Nombre_Especial };
    } else {
        return { id: docSnap.id, diaId: diaId, ...data };
    }
}

// --- Bloque de Exportación ---
export { // <-- ASEGURARSE QUE ESTE BLOQUE ESTÉ COMPLETO Y CORRECTO
    checkAndRunApp,
    loadAllDaysData,
    loadMemoriesForDay,
    saveDayName,
    saveMemory,
    deleteMemory,
    searchMemories,
    getTodaySpotlight,
    getMemoriesByType,
    getNamedDays
};
