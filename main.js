/*
 * main.js (v4.16 - Removed Image Upload Feature)
 * Controlador principal de Ephemerides.
 */

// --- Importaciones de Módulos ---
import { initFirebase, db, auth } from './firebase.js';
import { initAuthListener, handleLogin, handleLogout, checkAuthState } from './auth.js';
import {
    checkAndRunApp as storeCheckAndRun,
    loadAllDaysData,
    loadMemoriesForDay,
    saveDayName,
    saveMemory,
    deleteMemory,
    searchMemories,
    getTodaySpotlight,
    getMemoriesByType,
    getNamedDays
    // REMOVIDO uploadImage
} from './store.js';
import { searchiTunes, searchNominatim } from './api.js';
import { ui } from './ui.js';

// --- Estado Global de la App ---
let state = {
    allDaysData: [],
    currentMonthIndex: new Date().getMonth(),
    currentUser: null,
    todayId: '',
    dayInPreview: null,
    store: {
        currentType: null,
        lastVisible: null,
        isLoading: false,
    }
};

// --- 1. Inicialización de la App ---

async function checkAndRunApp() {
    console.log("Iniciando Ephemerides v4.16 (Removed Image Upload Feature)...");

    try {
        ui.setLoading("Iniciando...", true);
        initFirebase();
        ui.setLoading("Autenticando...", true);
        const user = await checkAuthState();
        console.log("Estado de autenticación inicial resuelto.");
        ui.setLoading("Verificando base de datos...", true);
        await storeCheckAndRun((message) => ui.setLoading(message, true));
        ui.setLoading("Cargando calendario...", true);
        state.allDaysData = await loadAllDaysData();

        if (state.allDaysData.length === 0) {
            throw new Error("La base de datos está vacía después de la verificación.");
        }

        const today = new Date();
        state.todayId = `${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;

        ui.init(getUICallbacks());
        initAuthListener(handleAuthStateChange);
        if (user) handleAuthStateChange(user);

        drawCurrentMonth();
        loadTodaySpotlight();

    } catch (err) {
        console.error("Error crítico durante el arranque:", err);
        if (err.code === 'permission-denied') {
             ui.setLoading(`Error: Permiso denegado por Firestore. Revisa tus reglas de seguridad.`, true);
        } else {
             ui.setLoading(`Error crítico: ${err.message}. Por favor, recarga.`, true);
        }
    }
}

// ... (loadTodaySpotlight, drawCurrentMonth no cambian) ...

// --- 2. Callbacks y Manejadores de Eventos ---
// ... (getUICallbacks no cambia, las funciones referenciadas sí) ...

// ... (handleLoginClick, handleLogoutClick, handleAuthStateChange no cambian) ...

// ... (handleMonthChange, handleDayClick, handleEditFromPreview no cambian) ...

// ... (handleFooterAction no cambia en esencia, pero ya no llamará a upload) ...

// ... (handleShuffleClick no cambia) ...

// --- 3. Lógica de Modales (Controlador) ---

// ... (handleSaveDayName no cambia) ...

async function handleSaveMemorySubmit(diaId, memoryData, isEditing) {

    if (!state.currentUser) {
        ui.showModalStatus('memoria-status', `Debes estar logueado`, true);
        return;
    }

    const saveBtn = document.getElementById('save-memoria-btn');

    try {
        if (!memoryData.year || isNaN(parseInt(memoryData.year))) {
            throw new Error('El año es obligatorio y debe ser un número.');
        }
        const year = parseInt(memoryData.year);

        if (year < 1900 || year > 2100) {
             throw new Error('El año debe estar entre 1900 y 2100.');
        }

        const month = parseInt(diaId.substring(0, 2), 10);
        const day = parseInt(diaId.substring(3, 5), 10);

        if (isNaN(month) || isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31) {
             throw new Error('El ID del día no es válido para extraer mes/día.');
        }

        const fullDate = new Date(Date.UTC(year, month - 1, day));
        if (fullDate.getUTCDate() !== day || fullDate.getUTCMonth() !== month - 1) {
             throw new Error(`Fecha inválida: El ${day}/${month}/${year} no existe.`);
        }
        memoryData.Fecha_Original = fullDate;
        delete memoryData.year;

        // --- SECCIÓN DE SUBIDA DE IMAGEN ELIMINADA ---
        /*
        if (memoryData.Tipo === 'Imagen' && memoryData.file) {
           // ... código eliminado ...
        }
        */

        const memoryId = isEditing ? memoryData.id : null; // id aquí es el ID del *documento* si se está editando
        await saveMemory(diaId, memoryData, memoryId); // saveMemory se encarga de borrar el campo 'id' interno si existe

        ui.showModalStatus('memoria-status', isEditing ? 'Memoria actualizada' : 'Memoria guardada', false);

        ui.resetMemoryForm();

        const updatedMemories = await loadMemoriesForDay(diaId);
        ui.updateMemoryList(updatedMemories);

        const dayIndex = state.allDaysData.findIndex(d => d.id === diaId);
        if (dayIndex !== -1 && !state.allDaysData[dayIndex].tieneMemorias) {
            state.allDaysData[dayIndex].tieneMemorias = true;
            drawCurrentMonth();
        }

    } catch (err) {
        console.error("Error guardando memoria:", err);
        ui.showModalStatus('memoria-status', `Error: ${err.message}`, true);
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = isEditing ? 'Actualizar Memoria' : 'Añadir Memoria';
        }
    }
}

async function handleDeleteMemory(diaId, mem) {
    if (!state.currentUser) {
        ui.showModalStatus('memoria-status', `Debes estar logueado`, true);
        return;
    }
    if (!mem || !mem.id) {
         ui.showModalStatus('memoria-status', `Error: Información de memoria inválida.`, true);
         console.error("handleDeleteMemory recibió:", mem);
         return;
    }

    // REMOVIDO tipo Imagen de la lógica de info
    const info = mem.Descripcion || mem.LugarNombre || mem.CancionInfo || 'esta memoria';
    const message = `¿Seguro que quieres borrar "${info.substring(0, 50)}..."?`;

    const confirmed = await ui.showConfirm(message);

    if (!confirmed) {
        return;
    }

    try {
        // REMOVIDO -> ya no se necesita la URL de la imagen
        // const imagenURL = (mem.Tipo === 'Imagen') ? mem.ImagenURL : null;
        await deleteMemory(diaId, mem.id, null); // Pasar null como imagenURL
        ui.showModalStatus('memoria-status', 'Memoria borrada', false);

        const updatedMemories = await loadMemoriesForDay(diaId);
        ui.updateMemoryList(updatedMemories);

        if (updatedMemories.length === 0) {
            const dayIndex = state.allDaysData.findIndex(d => d.id === diaId);
            if (dayIndex !== -1) {
                state.allDaysData[dayIndex].tieneMemorias = false;
                drawCurrentMonth();
            }
        }

    } catch (err) {
        console.error("Error borrando memoria:", err);
        ui.showModalStatus('memoria-status', `Error: ${err.message}`, true);
    }
}


// --- 4. Lógica de API Externa (Controlador) ---
// ... (handleMusicSearch, handlePlaceSearch no cambian) ...

// --- 5. Lógica del "Almacén" (Controlador) ---
// ... (handleStoreCategoryClick, handleStoreLoadMore, handleStoreItemClick no cambian, pero ya no mostrarán la categoría Imagen) ...

// --- 6. Lógica de Crumbie (IA) ---
// ... (handleCrumbieClick no cambia) ...


// --- 7. Ejecución Inicial ---
checkAndRunApp();
