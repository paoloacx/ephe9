/*
 * ui.js (v4.20.3 - Strict function order)
 * Módulo de interfaz de usuario.
 */

// --- Variables privadas del módulo (Estado de la UI) ---
let callbacks = {};
let _currentDay = null;
let _currentMemories = [];
let _allDaysData = [];
let _isEditingMemory = false;
let _selectedMusic = null; // Mover variables de estado del form aquí
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
    _selectedMusic = null; // Resetear selección

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
    _selectedPlace = null; // Resetear selección

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

// --- FIN: FUNCIONES HELPER / UTILIDADES ---

// --- INICIO: FUNCIONES PRINCIPALES Y DE MODALES ---

function init(mainCallbacks) {
    console.log("UI Module init (v4.20.3 - Strict function order)"); // Actualizar versión
    callbacks = mainCallbacks;

    // Crear Modales Primero (sus funciones `create...` usan helpers)
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
function _bindHeaderEvents() {
    document.getElementById('header-search-btn')?.addEventListener('click', () => {
        if (callbacks.onFooterAction) callbacks.onFooterAction('search');
    });
}

function _bindNavEvents() {
    const prevBtn = document.getElementById('prev-month');
    const nextBtn = document.getElementById('next-month');

    if (prevBtn) {
        prevBtn.onclick = () => {
            if (callbacks.onMonthChange) callbacks.onMonthChange('prev');
        };
    }
    if (nextBtn) {
        nextBtn.onclick = () => {
            if (callbacks.onMonthChange) callbacks.onMonthChange('next');
        };
    }
}

function _bindFooterEvents() {
    document.getElementById('btn-add-memory')?.addEventListener('click', () => {
        if (callbacks.onFooterAction) callbacks.onFooterAction('add');
    });
    document.getElementById('btn-store')?.addEventListener('click', () => {
        if (callbacks.onFooterAction) callbacks.onFooterAction('store');
    });
    document.getElementById('btn-shuffle')?.addEventListener('click', () => {
        if (callbacks.onFooterAction) callbacks.onFooterAction('shuffle');
    });
    document.getElementById('btn-settings')?.addEventListener('click', () => {
        if (callbacks.onFooterAction) callbacks.onFooterAction('settings');
    });
}

function _bindCrumbieEvents() {
    document.getElementById('crumbie-btn')?.addEventListener('click', () => {
        if (callbacks.onCrumbieClick) callbacks.onCrumbieClick();
    });
}

function _bindLoginEvents() {
    const header = document.querySelector('header');
    header?.addEventListener('click', (e) => {
        const loginBtn = e.target.closest('#login-btn');
        const userInfo = e.target.closest('#user-info');
        if (loginBtn?.dataset.action === 'login' && callbacks.onLogin) callbacks.onLogin();
        else if (userInfo && callbacks.onLogout) callbacks.onLogout();
    });
}

function _bindGlobalListeners() {
    document.body.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-preview')) closePreviewModal();
        if (e.target.classList.contains('modal-edit')) closeEditModal();
        if (e.target.classList.contains('modal-store')) closeStoreModal();
        if (e.target.classList.contains('modal-store-list')) closeStoreListModal();
        if (e.target.classList.contains('modal-alert-prompt')) closeAlertPromptModal(false);
        if (e.target.classList.contains('modal-confirm')) closeConfirmModal(false);
    });
}


// ... Funciones de Renderizado Principal (setLoading, updateLoginUI, drawCalendar, updateSpotlight) ...
function setLoading(message, show) {
    const appContent = document.getElementById('app-content');
    if (!appContent) return;
    if (show) {
        appContent.innerHTML = `<p class="loading-message">${message}</p>`;
    } else {
        const loading = appContent.querySelector('.loading-message');
        if (loading) loading.remove();
    }
}

function updateLoginUI(user) {
    const loginBtnContainer = document.getElementById('login-btn-container');
    const userInfo = document.getElementById('user-info');
    const userName = document.getElementById('user-name');
    const userImg = document.getElementById('user-img');

    if (!loginBtnContainer || !userInfo || !userName || !userImg) return;

    if (user) {
        userInfo.style.display = 'flex';
        userName.textContent = user.displayName || 'Usuario';
        userImg.src = user.photoURL || `https://placehold.co/30x30/ccc/fff?text=${user.displayName ? user.displayName[0] : '?'}`;
        _createLoginButton(true, loginBtnContainer); // Llama a helper
    } else {
        userInfo.style.display = 'none';
        _createLoginButton(false, loginBtnContainer); // Llama a helper
    }
}

function drawCalendar(monthName, days, todayId) {
    const monthNameDisplay = document.getElementById('month-name-display');
    const appContent = document.getElementById('app-content');

    if (monthNameDisplay) monthNameDisplay.textContent = monthName;
    if (!appContent) return;

    const grid = document.createElement('div');
    grid.className = 'calendario-grid';

    days.forEach(dia => {
        const btn = document.createElement('button');
        btn.className = 'dia-btn';
        btn.innerHTML = `<span class="dia-numero">${parseInt(dia.id.substring(3))}</span>`;
        if (dia.id === todayId) btn.classList.add('dia-btn-today');
        if (dia.tieneMemorias) btn.classList.add('tiene-memorias');
        btn.addEventListener('click', () => { if (callbacks.onDayClick) callbacks.onDayClick(dia); });
        grid.appendChild(btn);
    });

    appContent.innerHTML = '';
    appContent.appendChild(grid);
}

function updateSpotlight(dateString, dayName, memories) {
    const titleEl = document.getElementById('spotlight-date-header');
    const listEl = document.getElementById('today-memory-spotlight');
    if (titleEl) titleEl.textContent = dateString;
    if (!listEl) return;
    listEl.innerHTML = '';
    if (dayName) {
        const dayNameEl = document.createElement('h3');
        dayNameEl.className = 'spotlight-day-name';
        dayNameEl.textContent = `- ${dayName} -`;
        listEl.appendChild(dayNameEl);
    }
    const containerEl = document.createElement('div');
    containerEl.id = 'spotlight-memories-container';
    listEl.appendChild(containerEl);
    if (!memories || memories.length === 0) {
        containerEl.innerHTML = '<p class="list-placeholder">No hay memorias destacadas.</p>';
        return;
    }
    memories.forEach(mem => {
        const itemEl = document.createElement('div');
        itemEl.className = 'spotlight-memory-item';
        if (mem.Tipo === 'Texto') itemEl.classList.add('spotlight-item-text');
        itemEl.innerHTML = createMemoryItemHTML(mem, false); // Llama a helper
        itemEl.addEventListener('click', () => {
             const diaObj = _allDaysData.find(d => d.id === mem.diaId);
             if (diaObj && callbacks.onDayClick) callbacks.onDayClick(diaObj);
             else console.warn("Spotlight: No se encontró el día", mem.diaId);
        });
        containerEl.appendChild(itemEl);
    });
}

// ... Funciones Create/Open/Close/Bind para Modales ...
// (Definidas aquí ahora, usan helpers definidos antes)

// Preview
function createPreviewModal() { /* ... código ... */
    if (previewModal) return;
    previewModal = document.createElement('div'); /* ... innerHTML ... */ document.body.appendChild(previewModal);
    document.getElementById('close-preview-btn')?.addEventListener('click', closePreviewModal); // Llama a closePreviewModal
    document.getElementById('edit-from-preview-btn')?.addEventListener('click', () => { if (callbacks.onEditFromPreview) callbacks.onEditFromPreview(); });
}
function showPreviewLoading(isLoading) { /* ... código ... */ }
function openPreviewModal(dia, memories) { /* ... código ... */ _renderMemoryList(listEl, memories, false); /* ... código ... */ } // Llama a _renderMemoryList
function closePreviewModal() { /* ... código ... */ }

// Edit
function createEditModal() { /* ... código ... */
    if (editModal) return;
    editModal = document.createElement('div'); /* ... innerHTML ... */ document.body.appendChild(editModal);
    _bindEditModalEvents(); // Llama a _bindEditModalEvents
}
function showEditLoading(isLoading) { /* ... código ... */ }
async function handleNameSelectedDay() { /* ... código ... */ const newName = await showPrompt(/*...*/); /* ... */ } // Llama a showPrompt
function _bindEditModalEvents() { /* ... código ... */
    document.getElementById('close-edit-add-btn')?.addEventListener('click', closeEditModal); // Llama a closeEditModal
    // ... otros listeners ...
    document.getElementById('btn-show-add-form')?.addEventListener('click', () => { resetMemoryForm(); _showMemoryForm(true); }); // Llama a resetMemoryForm, _showMemoryForm
    document.getElementById('btn-cancel-mem-edit')?.addEventListener('click', () => { _showMemoryForm(false); }); // Llama a _showMemoryForm
    document.getElementById('memory-form')?.addEventListener('submit', _handleFormSubmit); // Llama a _handleFormSubmit
    document.getElementById('memoria-type')?.addEventListener('change', handleMemoryTypeChange); // Llama a handleMemoryTypeChange
    // ... listeners lista ...
        // if (editBtn) ... fillFormForEdit(memToEdit); // Llama a fillFormForEdit
        // if (deleteBtn) ... callbacks.onDeleteMemory(...)
}
function openEditModal(dia, memories, allDays) { /* ... código ... */
    _showMemoryForm(false); // Llama a helper
    resetMemoryForm(); // Llama a resetMemoryForm
    _renderMemoryList(document.getElementById('edit-memorias-list'), _currentMemories, true); // Llama a _renderMemoryList
    showModalStatus('save-status', '', false); // Llama a helper
    // ... código ...
}
function closeEditModal() { /* ... código ... */ }

// Store
function createStoreModal() { /* ... código ... */
    if (storeModal) return;
    storeModal = document.createElement('div'); /* ... innerHTML con createStoreCategoryButton ... */ document.body.appendChild(storeModal); // Llama a createStoreCategoryButton
    document.getElementById('close-store-btn')?.addEventListener('click', closeStoreModal); // Llama a closeStoreModal
    // ... listener ...
}
function openStoreModal() { /* ... código ... */ if (!storeModal) createStoreModal(); /* ... */ } // Llama a createStoreModal
function closeStoreModal() { /* ... código ... */ }

// Store List
function createStoreListModal() { /* ... código ... */
    if (storeListModal) return;
    storeListModal = document.createElement('div'); /* ... innerHTML ... */ document.body.appendChild(storeListModal);
    _bindStoreListModalEvents(); // Llama a _bindStoreListModalEvents
}
function _bindStoreListModalEvents() { /* ... código ... */ document.getElementById('close-store-list-btn')?.addEventListener('click', closeStoreListModal); /* ... */ } // Llama a closeStoreListModal
function openStoreListModal(title) { /* ... código ... */ if(!storeListModal) createStoreListModal(); /* ... */ } // Llama a createStoreListModal
function closeStoreListModal() { /* ... código ... */ }
function updateStoreList(items, append = false, hasMore = false) { /* ... código ... */ const itemEl = createStoreListItem(item); /* ... */ } // Llama a createStoreListItem

// Alert/Prompt/Confirm
function createAlertPromptModal() { /* ... código ... */ if (alertPromptModal) return; alertPromptModal = document.createElement('div'); /* ... innerHTML ... */ document.body.appendChild(alertPromptModal); _bindAlertPromptEvents(); } // Llama a _bindAlertPromptEvents
function _bindAlertPromptEvents() { /* ... */ document.getElementById('alert-prompt-ok')?.addEventListener('click', () => closeAlertPromptModal(true)); /* ... */ } // Llama a closeAlertPromptModal
function closeAlertPromptModal(isOk) { /* ... código ... */ }
function showAlert(message, type = 'default') { /* ... código ... */ if(!alertPromptModal) createAlertPromptModal(); /* ... */ } // Llama a createAlertPromptModal
function showPrompt(message, defaultValue = '', type = 'default') { /* ... código ... */ if(!alertPromptModal) createAlertPromptModal(); /* ... */ return new Promise(/* ... */); } // Llama a createAlertPromptModal
function createConfirmModal() { /* ... código ... */ if (confirmModal) return; confirmModal = document.createElement('div'); /* ... innerHTML ... */ document.body.appendChild(confirmModal); _bindConfirmModalEvents(); } // Llama a _bindConfirmModalEvents
function _bindConfirmModalEvents() { /* ... */ document.getElementById('confirm-ok')?.addEventListener('click', () => closeConfirmModal(true)); /* ... */ } // Llama a closeConfirmModal
function closeConfirmModal(isConfirmed) { /* ... código ... */ }
function showConfirm(message) { /* ... código ... */ if(!confirmModal) createConfirmModal(); /* ... */ return new Promise(/* ... */); } // Llama a createConfirmModal

// ... Lógica del Formulario (Submit, Change, Fill, Reset) ...
// (Definidas aquí ahora, usan helpers definidos antes)

function _handleFormSubmit(e) { /* ... código ... */ callbacks.onSaveMemory(diaId, formData, docIdToEdit); } // Llama a callback
function handleMemoryTypeChange() { /* ... código ... */ showMusicResults([]); showPlaceResults([]); } // Llama a helpers
function fillFormForEdit(mem) { /* ... código ... */ resetMemoryForm(); /*...*/ handleMemoryTypeChange(); /*...*/ showPlaceResults([mem.LugarData], true); /*...*/ showMusicResults([mem.CancionData], true); /*...*/ _showMemoryForm(true); /* ... */ } // Llama a helpers
function resetMemoryForm() { /* ... código ... */ showMusicResults([]); showPlaceResults([]); showModalStatus('memoria-status', '', false); handleMemoryTypeChange(); _showMemoryForm(false); } // Llama a helpers


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
    updateStoreList, updateMemoryList,
    resetMemoryForm, fillFormForEdit,
    showMusicResults, showPlaceResults,
    showModalStatus, handleMemoryTypeChange,
    showCrumbieAnimation
};
