/*
 * main.js (v4.15 - Modal Redesign)
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
    getNamedDays,
    uploadImage
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
    console.log("Iniciando Ephemerides v4.15 (Modal Redesign)...");

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

async function loadTodaySpotlight() {
    const today = new Date();
    const dateString = `Hoy, ${today.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}`;

    const spotlightData = await getTodaySpotlight(state.todayId);

    if (spotlightData) {
        spotlightData.memories.forEach(mem => {
            if (!mem.Nombre_Dia) {
                mem.Nombre_Dia = state.allDaysData.find(d => d.id === mem.diaId)?.Nombre_Dia || "Día";
            }
        });

        // CAMBIO: Pasar el nombre del día por separado a la UI
        const dayName = spotlightData.dayName !== 'Unnamed Day' ? spotlightData.dayName : null;
        ui.updateSpotlight(dateString, dayName, spotlightData.memories);
    }
}

function drawCurrentMonth() {
    const monthName = new Date(2024, state.currentMonthIndex, 1).toLocaleDateString('es-ES', { month: 'long' });
    const monthNumber = state.currentMonthIndex + 1;

    const diasDelMes = state.allDaysData.filter(dia =>
        parseInt(dia.id.substring(0, 2), 10) === monthNumber
    );

    ui.drawCalendar(monthName, diasDelMes, state.todayId);
}


// --- 2. Callbacks y Manejadores de Eventos ---

function getUICallbacks() {
    return {
        onMonthChange: handleMonthChange,
        onDayClick: handleDayClick,
        onFooterAction: handleFooterAction,
        onLogin: handleLoginClick,
        onLogout: handleLogoutClick,
        onEditFromPreview: handleEditFromPreview,
        onSaveDayName: handleSaveDayName,
        onSaveMemory: handleSaveMemorySubmit,
        onDeleteMemory: handleDeleteMemory,
        onSearchMusic: handleMusicSearch,
        onSearchPlace: handlePlaceSearch,
        onStoreCategoryClick: handleStoreCategoryClick,
        onStoreLoadMore: handleStoreLoadMore,
        onStoreItemClick: handleStoreItemClick,
        onCrumbieClick: handleCrumbieClick,
    };
}

// --- Manejadores de Autenticación ---

async function handleLoginClick() {
    try {
        await handleLogin();
    } catch (error) {
        console.error("Error en handleLoginClick:", error);
        ui.showAlert(`Error al iniciar sesión: ${error.message}`);
    }
}

async function handleLogoutClick() {
     try {
        await handleLogout();
    } catch (error) {
        console.error("Error en handleLogoutClick:", error);
        ui.showAlert(`Error al cerrar sesión: ${error.message}`);
    }
}

function handleAuthStateChange(user) {
    state.currentUser = user;
    ui.updateLoginUI(user);
    console.log("Estado de autenticación cambiado:", user ? user.uid : "Logged out");

    if (!user) {
        ui.closeEditModal();
    }
}

// --- Manejadores de UI ---

function handleMonthChange(direction) {
    if (direction === 'prev') {
        state.currentMonthIndex = (state.currentMonthIndex - 1 + 12) % 12;
    } else {
        state.currentMonthIndex = (state.currentMonthIndex + 1) % 12;
    }
    drawCurrentMonth();
}

async function handleDayClick(dia) {
    state.dayInPreview = dia;
    let memories = [];
    try {
        ui.showPreviewLoading(true);
        memories = await loadMemoriesForDay(dia.id);
        ui.showPreviewLoading(false);
    } catch (e) {
        ui.showPreviewLoading(false);
        console.error("Error cargando memorias para preview:", e);
        ui.showAlert(`Error al cargar memorias: ${e.message}`);
        state.dayInPreview = null;
        return;
    }
    ui.openPreviewModal(dia, memories);
}

async function handleEditFromPreview() {
    const dia = state.dayInPreview;
    if (!dia) {
        console.error("No hay día guardado en preview para editar.");
        return;
    }

    if (state.currentUser) {
        ui.closePreviewModal();
        setTimeout(async () => {
            let memories = [];
            try {
                 ui.showEditLoading(true);
                 memories = await loadMemoriesForDay(dia.id);
                 ui.showEditLoading(false);
            } catch (e) {
                 ui.showEditLoading(false);
                 console.error("Error cargando memorias para edición:", e);
                 ui.showAlert(`Error al cargar memorias: ${e.message}`);
                 return;
            }
            ui.openEditModal(dia, memories, state.allDaysData);
        }, 250);

    } else {
        ui.showAlert("Debes iniciar sesión para poder editar.");
    }
}


async function handleFooterAction(action) {
    switch (action) {
        case 'add':
            if (!state.currentUser) {
                ui.showAlert("Debes iniciar sesión para añadir memorias.");
                return;
            }
            // Abrir modal de edición en modo 'Añadir' (dia = null)
            ui.openEditModal(null, [], state.allDaysData);
            break;

        case 'store':
            ui.openStoreModal();
            break;

        case 'shuffle':
            handleShuffleClick();
            break;

        case 'search':
            // CAMBIO: Añadido tipo 'search' para el estilo del modal
            const searchTerm = await ui.showPrompt("Buscar en todas las memorias:", '', 'search');
            if (!searchTerm || searchTerm.trim() === '') return;

            const term = searchTerm.trim().toLowerCase();
            ui.setLoading(`Buscando "${term}"...`, true);

            try {
                const results = await searchMemories(term);
                ui.setLoading(null, false);
                drawCurrentMonth();

                if (results.length === 0) {
                    ui.updateSpotlight(`No hay resultados para "${term}"`, null, []);
                } else {
                    results.forEach(mem => {
                        if (!mem.Nombre_Dia) {
                            mem.Nombre_Dia = state.allDaysData.find(d => d.id === mem.diaId)?.Nombre_Dia || "Día";
                        }
                    });
                    ui.updateSpotlight(`Resultados para "${term}" (${results.length})`, null, results);
                }
            } catch (err) {
                 ui.setLoading(null, false);
                 drawCurrentMonth();
                 ui.showAlert(`Error al buscar: ${err.message}`);
            }
            break;

        case 'settings':
            ui.showAlert("Settings\n\nApp Version: 4.15\nMore settings coming soon!", 'settings');
            break;


        default:
            console.warn("Acción de footer desconocida:", action);
    }
}

function handleShuffleClick() {
    if (state.allDaysData.length === 0) return;

    const randomIndex = Math.floor(Math.random() * state.allDaysData.length);
    const randomDia = state.allDaysData[randomIndex];
    const randomMonthIndex = parseInt(randomDia.id.substring(0, 2), 10) - 1;

    if (state.currentMonthIndex !== randomMonthIndex) {
        state.currentMonthIndex = randomMonthIndex;
        drawCurrentMonth();
    }

    setTimeout(() => {
        handleDayClick(randomDia);
    }, 100);

    window.scrollTo(0, 0);
}


// --- 3. Lógica de Modales (Controlador) ---

async function handleSaveDayName(diaId, newName, statusElementId = 'save-status') {
    if (!state.currentUser) {
        ui.showModalStatus(statusElementId, `Debes estar logueado`, true);
        return;
    }
    const finalName = newName && newName.trim() !== '' ? newName.trim() : "Unnamed Day";


    try {
        await saveDayName(diaId, finalName);

        const dayIndex = state.allDaysData.findIndex(d => d.id === diaId);
        if (dayIndex !== -1) {
            state.allDaysData[dayIndex].Nombre_Especial = finalName;
        }

        ui.showModalStatus(statusElementId, 'Nombre guardado', false);
        drawCurrentMonth();

        // Actualizar el título del modal si estamos en modo Edición
        const editModalTitle = document.getElementById('edit-modal-title');
        // Usamos _currentDay (que se setea en openEditModal) para saber si estamos en modo Edición
        if (statusElementId === 'save-status' && state.dayInPreview) { // dayInPreview se usa en handleEditFromPreview para abrir edit
             const dia = state.dayInPreview;
             const dayName = finalName !== 'Unnamed Day' ? ` (${finalName})` : '';
             if (editModalTitle) editModalTitle.textContent = `Editando: ${dia.Nombre_Dia}${dayName}`;
        }
         // Actualizar el select en modo Añadir si existe
         const daySelect = document.getElementById('edit-mem-day');
         if (daySelect) {
             const option = daySelect.querySelector(`option[value="${diaId}"]`);
             if (option) {
                 const originalText = state.allDaysData.find(d => d.id === diaId)?.Nombre_Dia || diaId;
                 option.textContent = finalName !== 'Unnamed Day' ? `${originalText} (${finalName})` : originalText;
             }
         }


    } catch (err) {
        console.error("Error guardando nombre:", err);
        ui.showModalStatus(statusElementId, `Error: ${err.message}`, true);
    }
}


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

        if (memoryData.Tipo === 'Imagen' && memoryData.file) {
            if (!state.currentUser.uid) {
                throw new Error("Debes estar logueado para subir imágenes.");
            }
            ui.showModalStatus('image-upload-status', 'Subiendo imagen...', false);
            memoryData.ImagenURL = await uploadImage(memoryData.file, state.currentUser.uid, diaId);
            ui.showModalStatus('image-upload-status', 'Imagen subida.', false);

        }

        const memoryId = isEditing ? memoryData.id : null;
        await saveMemory(diaId, memoryData, memoryId);

        ui.showModalStatus('memoria-status', isEditing ? 'Memoria actualizada' : 'Memoria guardada', false);
        
        // CAMBIO v17.0: resetMemoryForm ahora también oculta el formulario
        ui.resetMemoryForm();

        const updatedMemories = await loadMemoriesForDay(diaId);
        ui.updateMemoryList(updatedMemories); // Actualiza la lista en el modal

        const dayIndex = state.allDaysData.findIndex(d => d.id === diaId);
        if (dayIndex !== -1 && !state.allDaysData[dayIndex].tieneMemorias) {
            state.allDaysData[dayIndex].tieneMemorias = true;
            drawCurrentMonth(); // Redibuja el calendario para mostrar dog-ear
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

    const info = mem.Descripcion || mem.LugarNombre || mem.CancionInfo || 'esta memoria';
    const message = `¿Seguro que quieres borrar "${info.substring(0, 50)}..."?`;

    const confirmed = await ui.showConfirm(message);

    if (!confirmed) {
        return;
    }

    try {
        const imagenURL = (mem.Tipo === 'Imagen') ? mem.ImagenURL : null;
        await deleteMemory(diaId, mem.id, imagenURL);
        ui.showModalStatus('memoria-status', 'Memoria borrada', false);

        const updatedMemories = await loadMemoriesForDay(diaId);
        ui.updateMemoryList(updatedMemories); // Actualiza lista en el modal

        if (updatedMemories.length === 0) {
            const dayIndex = state.allDaysData.findIndex(d => d.id === diaId);
            if (dayIndex !== -1) {
                state.allDaysData[dayIndex].tieneMemorias = false;
                drawCurrentMonth(); // Redibuja calendario para quitar dog-ear
            }
        }

    } catch (err) {
        console.error("Error borrando memoria:", err);
        ui.showModalStatus('memoria-status', `Error: ${err.message}`, true);
    }
}

// --- 4. Lógica de API Externa (Controlador) ---
async function handleMusicSearch(term) {
    if (!term || term.trim() === '') return;
    try {
        const results = await searchiTunes(term.trim());
        if (results && results.results) {
            ui.showMusicResults(results.results);
        } else {
             ui.showMusicResults([]);
        }
    } catch (err) {
        console.error("Error en búsqueda de iTunes:", err);
        ui.showModalStatus('memoria-status', `Error API iTunes: ${err.message}`, true);
    }
}

async function handlePlaceSearch(term) {
    if (!term || term.trim() === '') return;
    try {
        const places = await searchNominatim(term.trim());
        ui.showPlaceResults(places);
    } catch (err) {
        console.error("Error en búsqueda de Nominatim:", err);
        ui.showModalStatus('memoria-status', `Error API Lugares: ${err.message}`, true);
    }
}


// --- 5. Lógica del "Almacén" (Controlador) ---
async function handleStoreCategoryClick(type) {
    console.log("Cargando Almacén para:", type);

    state.store.currentType = type;
    state.store.lastVisible = null;
    state.store.isLoading = true;

    const title = `Almacén: ${type}`;
    ui.openStoreListModal(title);

    try {
        let result;
        if (type === 'Nombres') {
            result = await getNamedDays(10);
        } else {
            result = await getMemoriesByType(type, 10);
        }

        result.items.forEach(item => {
            if (!item.Nombre_Dia) {
                item.Nombre_Dia = state.allDaysData.find(d => d.id === item.diaId)?.Nombre_Dia || "Día";
            }
        });

        state.store.lastVisible = result.lastVisible;
        state.store.isLoading = false;

        ui.updateStoreList(result.items, false, result.hasMore);

    } catch (err) {
        console.error(`Error cargando categoría ${type}:`, err);
        ui.updateStoreList([], false, false);
        if (err.code === 'failed-precondition') {
            console.error("¡ÍNDICE DE FIREBASE REQUERIDO!", err.message);
            ui.showAlert("Error de Firebase: Se requiere un índice. Revisa la consola (F12) para ver el enlace de creación.");
        } else {
            ui.showAlert(`Error al cargar: ${err.message}`);
        }
        ui.closeStoreListModal();
    }
}

async function handleStoreLoadMore() {
    const { currentType, lastVisible, isLoading } = state.store;

    if (isLoading || !currentType || !lastVisible) return;

    console.log("Cargando más...", currentType);
    state.store.isLoading = true;

    try {
        let result;
        if (currentType === 'Nombres') {
            result = await getNamedDays(10, lastVisible);
        } else {
            result = await getMemoriesByType(currentType, 10, lastVisible);
        }

        result.items.forEach(item => {
            if (!item.Nombre_Dia) {
                item.Nombre_Dia = state.allDaysData.find(d => d.id === item.diaId)?.Nombre_Dia || "Día";
            }
        });

        state.store.lastVisible = result.lastVisible;
        state.store.isLoading = false;

        ui.updateStoreList(result.items, true, result.hasMore);

    } catch (err) {
        console.error(`Error cargando más ${currentType}:`, err);
        state.store.isLoading = false;
        const loadMoreBtn = document.getElementById('load-more-btn');
        if(loadMoreBtn) loadMoreBtn.textContent = "Error al cargar";
    }
}

function handleStoreItemClick(diaId) {
    const dia = state.allDaysData.find(d => d.id === diaId);
    if (!dia) {
        console.error("No se encontró el día:", diaId);
        return;
    }

    ui.closeStoreListModal();
    ui.closeStoreModal();

    const monthIndex = parseInt(dia.id.substring(0, 2), 10) - 1;
    if (state.currentMonthIndex !== monthIndex) {
        state.currentMonthIndex = monthIndex;
        drawCurrentMonth();
    }

    setTimeout(() => {
        handleDayClick(dia);
    }, 100);

    window.scrollTo(0, 0);
}

// --- 6. Lógica de Crumbie (IA) ---

function handleCrumbieClick() {
    const messages = [
        "¡Hola! ¿Qué buscamos?",
        "Pregúntame sobre tus recuerdos...",
        "¿Cuál es tu canción favorita?",
        "Buscando un día especial..."
    ];
    const msg = messages[Math.floor(Math.random() * messages.length)];
    
    ui.showCrumbieAnimation(msg);
    
    console.log("Crumbie clickeado. Listo para IA.");
}


// --- 7. Ejecución Inicial ---
checkAndRunApp();
