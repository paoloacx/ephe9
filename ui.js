/*
 * ui.js (v4.20.4 - Final function order fix)
 * Módulo de interfaz de usuario.
 */

// --- Variables privadas del módulo (Estado de la UI) ---
let callbacks = {};
let _currentDay = null;
let _currentMemories = [];
let _allDaysData = [];
let _isEditingMemory = false;
let _selectedMusic = null;
let _selectedPlace = null;

// Modales
let alertPromptModal = null;
let _promptResolve = null;
let confirmModal = null;
let _confirmResolve = null;
let previewModal = null;
let editModal = null;
let storeModal = null;
let storeListModal = null;

// --- INICIO: FUNCIONES HELPER / UTILIDADES (Definidas Primero) ---

function showModalStatus(elementId, message, isError) {
    const statusEl = document.getElementById(elementId);
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = isError ? 'status-message error' : 'status-message success';
    if (message && !isError) {
        setTimeout(() => { if (statusEl.textContent === message) { statusEl.textContent = ''; statusEl.className = 'status-message'; } }, 3000);
    }
}

function showMusicResults(tracks, isSelected = false) {
    const resultsEl = document.getElementById('itunes-results');
    if (!resultsEl) return;
    resultsEl.innerHTML = '';
    _selectedMusic = null;

    if (isSelected && tracks && tracks.length > 0) {
        const track = tracks[0];
        _selectedMusic = track;
        resultsEl.innerHTML = `<p class="search-result-selected">Seleccionado: ${track.trackName}</p>`;
        return;
    }

    if (!tracks || tracks.length === 0) return;

    tracks.forEach(track => {
        const itemEl = document.createElement('div');
        itemEl.className = 'search-result-item';
        const artwork = track.artworkUrl60 || '';
        itemEl.innerHTML = `
            <img src="${artwork}" class="memoria-artwork" alt="" ${artwork ? '' : 'style="display:none;"'}>
            <div class="memoria-item-content">
                <small>${track.artistName}</small>
                <strong>${track.trackName}</strong>
            </div>
            <span class="material-icons-outlined">add_circle_outline</span>
        `;
        itemEl.addEventListener('click', () => {
            _selectedMusic = track;
            document.getElementById('memoria-music-search').value = `${track.trackName} - ${track.artistName}`;
            resultsEl.innerHTML = `<p class="search-result-selected">Seleccionado: ${track.trackName}</p>`;
        });
        resultsEl.appendChild(itemEl);
    });
}

function showPlaceResults(places, isSelected = false) {
    const resultsEl = document.getElementById('place-results');
    if (!resultsEl) return;
    resultsEl.innerHTML = '';
    _selectedPlace = null;

    if (isSelected && places && places.length > 0) {
        const place = places[0];
        const displayName = place.display_name || place.name || 'Lugar seleccionado';
        _selectedPlace = { name: displayName, data: place };
        resultsEl.innerHTML = `<p class="search-result-selected">Seleccionado: ${displayName}</p>`;
        return;
    }

    if (!places || places.length === 0) return;

    places.forEach(place => {
        const itemEl = document.createElement('div');
        itemEl.className = 'search-result-item';
        const displayName = place.display_name || 'Lugar sin nombre';
        itemEl.innerHTML = `
            <span class="memoria-icon material-icons-outlined">place</span>
            <div class="memoria-item-content"><strong>${displayName}</strong></div>
            <span class="material-icons-outlined">add_circle_outline</span>
        `;
        itemEl.addEventListener('click', () => {
            _selectedPlace = { name: displayName, data: place };
            document.getElementById('memoria-place-search').value = displayName;
            resultsEl.innerHTML = `<p class="search-result-selected">Seleccionado: ${displayName.substring(0, 40)}...</p>`;
        });
        resultsEl.appendChild(itemEl);
    });
}

function _showMemoryForm(show) {
    const form = document.getElementById('memory-form');
    const listContainer = document.getElementById('edit-memorias-list-container');
    if (form) form.style.display = show ? 'block' : 'none';
    if (listContainer) listContainer.style.display = show ? 'none' : 'block';
}

function createMemoryItemHTML(mem, showActions) {
    if (!mem) return '';
    const memId = mem.id || '';

    let yearStr = 'Año desc.';
    if (mem.Fecha_Original) {
        try {
            const date = new Date(mem.Fecha_Original.seconds * 1000 || mem.Fecha_Original);
            if (!isNaN(date)) yearStr = date.getFullYear();
        } catch (e) { console.warn("Fecha inválida:", mem.Fecha_Original); }
    }

    let contentHTML = `<small>${yearStr}</small>`;
    let artworkHTML = '';
    let icon = 'article';

    switch (mem.Tipo) {
        case 'Lugar':
            icon = 'place';
            contentHTML += `${mem.LugarNombre || 'Lugar sin nombre'}`;
            break;
        case 'Musica':
            icon = 'music_note';
            if (mem.CancionData?.trackName) {
                contentHTML += `<strong>${mem.CancionData.trackName}</strong> <span class="artist-name">by ${mem.CancionData.artistName}</span>`;
                if(mem.CancionData.artworkUrl60) artworkHTML = `<img src="${mem.CancionData.artworkUrl60}" class="memoria-artwork" alt="Artwork">`;
            } else { contentHTML += `${mem.CancionInfo || 'Canción sin nombre'}`; }
            break;
        case 'Texto': default:
            icon = 'article';
            contentHTML += (mem.Descripcion || 'Nota vacía');
            break;
    }

    if (!artworkHTML) artworkHTML = `<span class="memoria-icon material-icons-outlined">${icon}</span>`;

    const actionsHTML = (showActions && memId) ? `
        <div class="memoria-actions">
            <button class="edit-btn" title="Editar" data-memoria-id="${memId}"><span class="material-icons-outlined">edit</span></button>
            <button class="delete-btn" title="Borrar" data-memoria-id="${memId}"><span class="material-icons-outlined">delete</span></button>
        </div>` : '';

    return `${artworkHTML}<div class="memoria-item-content">${contentHTML}</div>${actionsHTML}`;
}

function createStoreCategoryButton(type, icon, label) {
    return `
        <button class="store-category-button" data-type="${type}">
            <span class="material-icons-outlined">${icon}</span>
            <span>${label}</span>
            <span class="material-icons-outlined">chevron_right</span>
        </button>`;
}

function createStoreListItem(item) {
    const itemEl = document.createElement('div');
    itemEl.className = 'store-list-item';
    let contentHTML = '';
    if (item.type === 'Nombres') {
        itemEl.dataset.diaId = item.id;
        contentHTML = `<span class="memoria-icon material-icons-outlined">label</span><div class="memoria-item-content"><small>${item.Nombre_Dia}</small><strong>${item.Nombre_Especial}</strong></div>`;
    } else {
        itemEl.dataset.diaId = item.diaId;
        itemEl.dataset.id = item.id;
        const memoryHTML = createMemoryItemHTML(item, false); // Llama a createMemoryItemHTML
        contentHTML = `${memoryHTML}<div class="store-item-day-ref">${item.Nombre_Dia}</div>`;
    }
    itemEl.innerHTML = contentHTML;
    return itemEl;
}

function _createLoginButton(isLoggedIn, container) {
    if (!container) return;
    const btn = document.createElement('button');
    btn.id = 'login-btn';
    btn.className = 'header-login-btn';
    if (isLoggedIn) {
        btn.title = 'Cerrar sesión';
        btn.dataset.action = 'logout';
        btn.innerHTML = `<span class="material-icons-outlined">logout</span>`;
    } else {
        btn.title = 'Iniciar sesión con Google';
        btn.dataset.action = 'login';
        btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg"><path fill="#4285F4" d="M17.64 9.20455c0-.63864-.05727-1.25182-.16909-1.84091H9v3.48182h4.84364c-.20864 1.125-.84273 2.07818-1.77727 2.71136v2.25818h2.90864c1.70182-1.56682 2.68409-3.87409 2.68409-6.61045z"/><path fill="#34A853" d="M9 18c2.43 0 4.47182-.80591 5.96273-2.18045l-2.90864-2.25818c-.80591.54364-1.83682.86591-2.94.86591-2.27318 0-4.20727-1.53318-4.9-3.58227H1.07182v2.33318C2.56636 16.3 5.56 18 9 18z"/><path fill="#FBBC05" d="M4.1 10.71c-.22-.64-.35-1.32-.35-2.03s.13-.139.35-2.03V4.31H1.07C.38 5.67 0 7.29 0 9.03s.38 3.36 1.07 4.72l3.03-2.33v.03z"/><path fill="#EA4335" d="M9 3.57955c1.32136 0 2.50773.45455 3.44091 1.34591l2.58136-2.58136C13.46318.891364 11.4259 0 9 0 5.56 0 2.56636 1.70182 1.07182 4.31l3.02818 2.33318C4.79273 5.11273 6.72682 3.57955 9 3.57955z"/></svg>`;
    }
    container.innerHTML = '';
    container.appendChild(btn);
}

function showCrumbieAnimation(message) {
    if (document.querySelector('.crumbie-float-text')) return;
    const textEl = document.createElement('div');
    textEl.className = 'crumbie-float-text';
    textEl.textContent = message;
    document.body.appendChild(textEl);
    textEl.addEventListener('animationend', () => textEl.remove());
}

// *** MOVIDAS AQUÍ: _renderMemoryList y updateMemoryList ***
function _renderMemoryList(listEl, memories, showActions) {
    if (!listEl) return;
    listEl.innerHTML = '';
    if (!memories || memories.length === 0) {
        listEl.innerHTML = '<p class="list-placeholder">No hay memorias para este día.</p>';
        return;
    }
    memories.sort((a, b) => (b.Fecha_Original?.toMillis() || 0) - (a.Fecha_Original?.toMillis() || 0));
    const fragment = document.createDocumentFragment();
    memories.forEach(mem => {
        const itemEl = document.createElement('div');
        itemEl.className = 'memoria-item';
        itemEl.innerHTML = createMemoryItemHTML(mem, showActions); // Llama a helper
        fragment.appendChild(itemEl);
    });
    listEl.appendChild(fragment);
}

function updateMemoryList(memories) { // <-- DEFINICIÓN AHORA ESTÁ AQUÍ
    _currentMemories = memories || [];
    const editList = document.getElementById('edit-memorias-list');
    // Asegurarse de que el modal de edición existe y es visible
    if (editList && editModal?.style.display !== 'none' && editModal?.classList.contains('visible')) {
        _renderMemoryList(editList, _currentMemories, true); // Llama a _renderMemoryList
    }
    const previewList = document.getElementById('preview-memorias-list');
    if (previewList && previewModal?.classList.contains('visible') && _currentDay) {
         _renderMemoryList(previewList, _currentMemories, false); // Llama a _renderMemoryList
    }
}

// --- FIN: FUNCIONES HELPER / UTILIDADES ---

// --- INICIO: FUNCIONES PRINCIPALES Y DE MODALES ---

function init(mainCallbacks) {
    console.log("UI Module init (v4.20.4 - Final function order fix)"); // Actualizar versión
    callbacks = mainCallbacks;

    // Crear Modales Primero
    createPreviewModal();
    createEditModal();
    createStoreModal();
    createStoreListModal();
    createAlertPromptModal();
    createConfirmModal();

    // Luego Bind events generales
    _bindHeaderEvents();
    _bindNavEvents();
    _bindFooterEvents();
    _bindLoginEvents();
    _bindGlobalListeners();
    _bindCrumbieEvents();
}

// ... Funciones _bind... (sin cambios) ...
function _bindHeaderEvents() { /* ... */ }
function _bindNavEvents() { /* ... */ }
function _bindFooterEvents() { /* ... */ }
function _bindCrumbieEvents() { /* ... */ }
function _bindLoginEvents() { /* ... */ }
function _bindGlobalListeners() { /* ... */ }


// ... Funciones de Renderizado Principal (setLoading, updateLoginUI, drawCalendar, updateSpotlight) ...
function setLoading(message, show) { /* ... */ }
function updateLoginUI(user) { /* ... */ _createLoginButton(/* ... */); } // Llama a helper
function drawCalendar(monthName, days, todayId) { /* ... */ }
function updateSpotlight(dateString, dayName, memories) { /* ... */ createMemoryItemHTML(mem, false); /* ... */ } // Llama a helper

// ... Funciones Create/Open/Close/Bind para Modales ...
// Preview
function createPreviewModal() { if (previewModal) return; previewModal = document.createElement('div'); /* ... innerHTML ... */ document.body.appendChild(previewModal); document.getElementById('close-preview-btn')?.addEventListener('click', closePreviewModal); document.getElementById('edit-from-preview-btn')?.addEventListener('click', () => { if (callbacks.onEditFromPreview) callbacks.onEditFromPreview(); }); }
function showPreviewLoading(isLoading) { const loadingEl = previewModal?.querySelector('.preview-loading'); /* ... */ }
function openPreviewModal(dia, memories) { if (!previewModal) createPreviewModal(); _currentDay = dia; /* ... */ _renderMemoryList(listEl, memories, false); /* ... */ } // Llama a _renderMemoryList
function closePreviewModal() { if (!previewModal) return; /* ... */ }

// Edit
function createEditModal() { if (editModal) return; editModal = document.createElement('div'); /* ... innerHTML ... */ document.body.appendChild(editModal); _bindEditModalEvents(); } // Llama a _bindEditModalEvents
function showEditLoading(isLoading) { /* ... */ }
async function handleNameSelectedDay() { /* ... */ const newName = await showPrompt(/*...*/); /* ... */ } // Llama a showPrompt
function _bindEditModalEvents() { document.getElementById('close-edit-add-btn')?.addEventListener('click', closeEditModal); /* ... */ document.getElementById('btn-show-add-form')?.addEventListener('click', () => { resetMemoryForm(); _showMemoryForm(true); }); /* ... */ document.getElementById('memory-form')?.addEventListener('submit', _handleFormSubmit); document.getElementById('memoria-type')?.addEventListener('change', handleMemoryTypeChange); /* ... */ listEl?.addEventListener('click', (e) => { /* ... */ if (editBtn) { /* ... */ fillFormForEdit(memToEdit); } /* ... */ }); } // Llama a closeEditModal, resetMemoryForm, _showMemoryForm, _handleFormSubmit, handleMemoryTypeChange, fillFormForEdit
function openEditModal(dia, memories, allDays) { if (!editModal) createEditModal(); /* ... */ _showMemoryForm(false); resetMemoryForm(); _renderMemoryList(/*...*/, true); showModalStatus(/*...*/); /* ... */ } // Llama a createEditModal, _showMemoryForm, resetMemoryForm, _renderMemoryList, showModalStatus
function closeEditModal() { if (!editModal) return; /* ... */ }

// Store
function createStoreModal() { if (storeModal) return; storeModal = document.createElement('div'); /* ... innerHTML con createStoreCategoryButton ... */ document.body.appendChild(storeModal); document.getElementById('close-store-btn')?.addEventListener('click', closeStoreModal); /* ... */ } // Llama a createStoreCategoryButton, closeStoreModal
function openStoreModal() { if (!storeModal) createStoreModal(); storeModal.style.display = 'flex'; setTimeout(() => storeModal.classList.add('visible'), 10); } // Llama a createStoreModal
function closeStoreModal() { if (!storeModal) return; /* ... */ }

// Store List
function createStoreListModal() { if (storeListModal) return; storeListModal = document.createElement('div'); /* ... innerHTML ... */ document.body.appendChild(storeListModal); _bindStoreListModalEvents(); } // Llama a _bindStoreListModalEvents
function _bindStoreListModalEvents() { document.getElementById('close-store-list-btn')?.addEventListener('click', closeStoreListModal); /* ... */ } // Llama a closeStoreListModal
function openStoreListModal(title) { if(!storeListModal) createStoreListModal(); /* ... */ } // Llama a createStoreListModal
function closeStoreListModal() { if (!storeListModal) return; /* ... */ }
function updateStoreList(items, append = false, hasMore = false) { /* ... */ const itemEl = createStoreListItem(item); /* ... */ } // Llama a createStoreListItem

// Alert/Prompt/Confirm
function createAlertPromptModal() { if (alertPromptModal) return; alertPromptModal = document.createElement('div'); /* ... innerHTML ... */ document.body.appendChild(alertPromptModal); _bindAlertPromptEvents(); } // Llama a _bindAlertPromptEvents
function _bindAlertPromptEvents() { document.getElementById('alert-prompt-ok')?.addEventListener('click', () => closeAlertPromptModal(true)); document.getElementById('alert-prompt-cancel')?.addEventListener('click', () => closeAlertPromptModal(false)); } // Llama a closeAlertPromptModal
function closeAlertPromptModal(isOk) { if (!alertPromptModal) return; /* ... */ if (_promptResolve) { /* ... */ _promptResolve = null; } }
function showAlert(message, type = 'default') { if(!alertPromptModal) createAlertPromptModal(); /* ... */ } // Llama a createAlertPromptModal
function showPrompt(message, defaultValue = '', type = 'default') { if(!alertPromptModal) createAlertPromptModal(); /* ... */ return new Promise((resolve) => { _promptResolve = resolve; }); } // Llama a createAlertPromptModal
function createConfirmModal() { if (confirmModal) return; confirmModal = document.createElement('div'); /* ... innerHTML ... */ document.body.appendChild(confirmModal); _bindConfirmModalEvents(); } // Llama a _bindConfirmModalEvents
function _bindConfirmModalEvents() { document.getElementById('confirm-ok')?.addEventListener('click', () => closeConfirmModal(true)); document.getElementById('confirm-cancel')?.addEventListener('click', () => closeConfirmModal(false)); } // Llama a closeConfirmModal
function closeConfirmModal(isConfirmed) { if (!confirmModal) return; /* ... */ if (_confirmResolve) { _confirmResolve(isConfirmed); _confirmResolve = null; } }
function showConfirm(message) { if(!confirmModal) createConfirmModal(); /* ... */ return new Promise((resolve) => { _confirmResolve = resolve; }); } // Llama a createConfirmModal

// ... Lógica del Formulario (Submit, Change, Fill, Reset) ...
function _handleFormSubmit(e) { e.preventDefault(); /* ... */ callbacks.onSaveMemory(diaId, formData, docIdToEdit); } // Llama a callback
function handleMemoryTypeChange() { /* ... código ... */ showMusicResults([]); showPlaceResults([]); } // Llama a helpers
function fillFormForEdit(mem) { /* ... código ... */ resetMemoryForm(); /*...*/ handleMemoryTypeChange(); /*...*/ showPlaceResults(/*...*/); /*...*/ showMusicResults(/*...*/); /*...*/ _showMemoryForm(true); /* ... */ } // Llama a helpers
function resetMemoryForm() { /* ... código ... */ showMusicResults([]); showPlaceResults([]); showModalStatus(/*...*/); handleMemoryTypeChange(); _showMemoryForm(false); } // Llama a helpers


// --- Exportaciones Públicas ---
export const ui = {
    init,
    setLoading,
    updateLoginUI,
    drawCalendar,
    updateSpotlight,
    openPreviewModal, closePreviewModal, showPreviewLoading,
    openEditModal, closeEditModal, showEditLoading,
    openStoreModal, closeStoreModal,
    openStoreListModal, closeStoreListModal,
    showAlert, showPrompt, showConfirm,
    updateStoreList, updateMemoryList, // Asegurar que está exportada
    resetMemoryForm, fillFormForEdit,
    showMusicResults, showPlaceResults,
    showModalStatus, handleMemoryTypeChange,
    showCrumbieAnimation
};
