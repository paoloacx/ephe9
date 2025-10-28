/*
 * store.js (v4.10 - Corregido id: null al guardar)
 * Módulo de Lógica de Firestore y Storage.
 */

import { db, storage } from './firebase.js';
import {
    collection, getDocs, doc, updateDoc,
    writeBatch, setDoc, deleteDoc, Timestamp, query,
    orderBy, addDoc, getDoc, limit, collectionGroup,
    where, startAfter,
    documentId
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import {
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-storage.js";

// --- Constantes ---
const DIAS_COLLECTION = "Dias";
const MEMORIAS_COLLECTION = "Memorias";
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// --- 1. Lógica de Inicialización (Check/Repair) ---

async function checkAndRunApp(onProgress) {
    console.log("Store: Verificando base de datos...");
    const diasRef = collection(db, DIAS_COLLECTION);

    try {
        // Esta es la primera lectura. Si falla (permisos), irá al catch.
        const checkDoc = await getDoc(doc(db, DIAS_COLLECTION, "01-01"));

        if (!checkDoc.exists()) {
             console.warn("Store: El día 01-01 no existe. Regenerando base de datos...");
             await _generateCleanDatabase(onProgress);
        } else {
             console.log("Store: Base de datos verificada (01-01 existe).");
        }
    } catch (e) {
         console.error("Error al verificar la base de datos (puede ser por permisos o doc no existe):", e);
         // Si la lectura falla, intentamos regenerar (lo cual fallará si es por permisos,
         // pero funcionará si el doc '01-01' simplemente no existía y las reglas lo permiten).
         try {
            await _generateCleanDatabase(onProgress);
         } catch (genError) {
            console.error("Store: Fallo crítico al regenerar la base de datos.", genError);
            // Relanzamos el error para que main.js lo muestre
            throw genError;
         }
    }
}

async function _generateCleanDatabase(onProgress) {
    const diasRef = collection(db, DIAS_COLLECTION);

    // 1. Borrar todos los documentos existentes
    try {
        onProgress("Borrando datos antiguos...");
        console.log("Store: Borrando 'Dias'...");
        const oldDocsSnapshot = await getDocs(diasRef); // <-- Segunda lectura

        if (!oldDocsSnapshot.empty) {
            let batch = writeBatch(db);
            let deleteCount = 0;

            for (const docSnap of oldDocsSnapshot.docs) {
                if (docSnap.id.length === 5 && docSnap.id.includes('-')) {
                    batch.delete(docSnap.ref);
                    deleteCount++;
                    if (deleteCount >= 400) {
                        await batch.commit();
                        batch = writeBatch(db);
                        deleteCount = 0;
                    }
                }
            }
            if (deleteCount > 0) {
                await batch.commit();
            }
            console.log(`Store: Borrado completo (${oldDocsSnapshot.docs.length} días intentados).`); // Ajustado log
        } else {
            console.log("Store: La colección 'Dias' ya estaba vacía.");
        }
    } catch (e) {
        console.error("Store: Error borrando colección (posiblemente reglas de Firestore):", e);
        // NO relanzar, intentar generar de todos modos
    }

    // 2. Generar 366 días limpios
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
                const diaId = `${monthStr}-${dayStr}`; // "01-01"

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
            await genBatch.commit(); // <-- Escritura
        }

        console.log(`Store: Regeneración completa: ${created} días creados.`);
        onProgress(`Base de datos regenerada: ${created} días.`);

    } catch (e) {
        console.error("Store: Error generando días (posiblemente reglas de Firestore):", e);
        throw e; // Relanzar error para que main.js lo pille
    }
}

// --- 2. Lógica de Lectura (Días y Memorias) ---

async function loadAllDaysData() {
    // CORRECCIÓN: Usar documentId() en lugar de document.id()
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
            memories.push({
                id: doc.id,
                diaId: todayId,
                ...doc.data()
            });
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
    await updateDoc(diaRef, {
        Nombre_Especial: finalName
    });
}

async function saveMemory(diaId, memoryData, memoryId) {
    const diaRef = doc(db, DIAS_COLLECTION, diaId);

    if (memoryData.Fecha_Original && !(memoryData.Fecha_Original instanceof Timestamp)) {
        memoryData.Fecha_Original = Timestamp.fromDate(memoryData.Fecha_Original);
    }

    delete memoryData.file; // Borrar el archivo si existe (no se guarda en Firestore)

    // *** INICIO DE LA CORRECCIÓN ***
    // Eliminar la propiedad 'id' del objeto de datos ANTES de guardarlo,
    // ya sea para añadir o actualizar. Firestore gestiona el ID del documento.
    delete memoryData.id;
    // *** FIN DE LA CORRECCIÓN ***

    if (memoryId) { // Actualizar documento existente
        const memRef = doc(db, DIAS_COLLECTION, diaId, MEMORIAS_COLLECTION, memoryId);
        await updateDoc(memRef, memoryData); // memoryData ya no tiene 'id'

    } else { // Añadir nuevo documento
        memoryData.Creado_En = Timestamp.now();
        const memRef = collection(db, DIAS_COLLECTION, diaId, MEMORIAS_COLLECTION);
        await addDoc(memRef, memoryData); // memoryData ya no tiene 'id: null'
    }

    // Marcar el día como que tiene memorias
    await updateDoc(diaRef, {
        tieneMemorias: true
    });
}


async function deleteMemory(diaId, memId, imagenURL) {

    // Borrar imagen de Storage si existe
    if (imagenURL) {
        try {
            const imageRef = ref(storage, imagenURL); // Obtener referencia desde la URL
            await deleteObject(imageRef);
            console.log("Store: Imagen borrada de Storage:", imagenURL);
        } catch (error) {
            // No bloquear la eliminación del documento si falla el borrado del archivo
            console.warn("Store: No se pudo borrar la imagen de Storage:", error.code);
        }
    }

    // Borrar el documento de Firestore
    const memRef = doc(db, DIAS_COLLECTION, diaId, MEMORIAS_COLLECTION, memId);
    await deleteDoc(memRef);

    // Comprobar si quedan memorias en ese día
    const memoriasRef = collection(db, DIAS_COLLECTION, diaId, MEMORIAS_COLLECTION);
    const q = query(memoriasRef, limit(1));
    const snapshot = await getDocs(q);

    // Si no quedan, actualizar el día para quitar la marca
    if (snapshot.empty) {
        const diaRef = doc(db, DIAS_COLLECTION, diaId);
        await updateDoc(diaRef, {
            tieneMemorias: false
        });
    }
}

async function uploadImage(file, userId, diaId) {
    if (!file || !userId || !diaId) {
        throw new Error("Faltan datos (archivo, userId o diaId) para subir la imagen.");
    }

    const fileExtension = file.name.split('.').pop();
    const uniqueName = `${diaId}_${Date.now()}.${fileExtension}`;
    const storagePath = `images/${userId}/${uniqueName}`;
    const imageRef = ref(storage, storagePath);

    console.log(`Store: Subiendo imagen a: ${storagePath}`);

    const snapshot = await uploadBytes(imageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);

    console.log("Store: Imagen subida, URL:", downloadURL);
    return downloadURL;
}


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
                const memoria = {
                    id: memDoc.id, // ID del documento de memoria
                    diaId: diaId, // ID del día padre
                    Nombre_Dia: diaDoc.data().Nombre_Dia, // Nombre del día padre
                    ...memDoc.data() // Datos de la memoria
                };

                let searchableText = (memoria.Descripcion || '').toLowerCase();
                if (memoria.LugarNombre) searchableText += ' ' + (memoria.LugarNombre || '').toLowerCase();
                if (memoria.CancionInfo) searchableText += ' ' + (memoria.CancionInfo || '').toLowerCase();

                if (searchableText.includes(term)) {
                    results.push(memoria);
                }
            });
        })();

        searchPromises.push(p);
    });

    await Promise.all(searchPromises);

    results.sort((a, b) => {
        const dateA = a.Fecha_Original ? a.Fecha_Original.toMillis() : 0;
        const dateB = b.Fecha_Original ? b.Fecha_Original.toMillis() : 0;
        return dateB - dateA;
    });

    return results;
}

async function getMemoriesByType(type, pageSize = 10, lastVisibleDoc = null) {
    const memoriasGroupRef = collectionGroup(db, MEMORIAS_COLLECTION);

    let q;
    if (lastVisibleDoc) {
        q = query(memoriasGroupRef,
            where("Tipo", "==", type),
            orderBy("Fecha_Original", "desc"),
            startAfter(lastVisibleDoc),
            limit(pageSize)
        );
    } else {
        q = query(memoriasGroupRef,
            where("Tipo", "==", type),
            orderBy("Fecha_Original", "desc"),
            limit(pageSize)
        );
    }

    const querySnapshot = await getDocs(q);

    const items = [];
    for (const docSnap of querySnapshot.docs) { // Cambiado a for...of para async
        const diaId = docSnap.ref.parent.parent.id;
        items.push(_formatStoreItem(docSnap, diaId)); // No necesitamos await aquí
    }

    const lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];

    let hasMore = false;
    if (lastVisible) {
        const nextQuery = query(memoriasGroupRef,
            where("Tipo", "==", type),
            orderBy("Fecha_Original", "desc"),
            startAfter(lastVisible),
            limit(1)
        );
        const nextSnapshot = await getDocs(nextQuery);
        hasMore = !nextSnapshot.empty;
    }

    return { items, lastVisible, hasMore };
}


async function getNamedDays(pageSize = 10, lastVisibleDoc = null) {
    const diasRef = collection(db, DIAS_COLLECTION);

    let q;
    if (lastVisibleDoc) {
        q = query(diasRef,
            where("Nombre_Especial", "!=", "Unnamed Day"),
            orderBy("Nombre_Especial", "asc"),
            startAfter(lastVisibleDoc),
            limit(pageSize)
        );
    } else {
        q = query(diasRef,
            where("Nombre_Especial", "!=", "Unnamed Day"),
            orderBy("Nombre_Especial", "asc"),
            limit(pageSize)
        );
    }

    const querySnapshot = await getDocs(q);

    const items = [];
    querySnapshot.forEach(doc => {
        items.push(_formatStoreItem(doc, doc.id, true)); // true = isDay
    });

    const lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];

    let hasMore = false;
    if (lastVisible) {
        const nextQuery = query(diasRef,
            where("Nombre_Especial", "!=", "Unnamed Day"),
            orderBy("Nombre_Especial", "asc"),
            startAfter(lastVisible),
            limit(1)
        );
        const nextSnapshot = await getDocs(nextQuery);
        hasMore = !nextSnapshot.empty;
    }

    return { items, lastVisible, hasMore };
}


// --- 5. Funciones de Ayuda (Helpers) ---

function _formatStoreItem(docSnap, diaId, isDay = false) {
    const data = docSnap.data();
    if (isDay) {
        return {
            id: docSnap.id, // ID del día
            diaId: docSnap.id, // ID del día (para consistencia)
            type: 'Nombres', // Tipo especial para días nombrados
            Nombre_Dia: data.Nombre_Dia,
            Nombre_Especial: data.Nombre_Especial
        };
    } else {
        return {
            id: docSnap.id, // ID de la memoria
            diaId: diaId, // ID del día padre
            ...data // Datos de la memoria
        };
    }
}

export {
    checkAndRunApp,
    loadAllDaysData,
    loadMemoriesForDay,
    saveDayName,
    saveMemory,
    deleteMemory,
    uploadImage,
    searchMemories,
    getTodaySpotlight,
    getMemoriesByType,
    getNamedDays
};
