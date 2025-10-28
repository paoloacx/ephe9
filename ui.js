/*
 * ui.js (v4.20.2 - Reordered modal functions)
 * Módulo de interfaz de usuario.
 */

// --- Variables privadas del módulo (Estado de la UI) ---
let callbacks = {}; // Almacena las funciones de main.js
let _currentDay = null; // El día abierto en el modal de edición O preview
let _currentMemories = []; // Las memorias del día abierto
let _allDaysData = []; // Referencia a todos los días (para el <select>)
let _isEditingMemory = false; // Estado del formulario (Añadir vs Editar)

// Variables para modales de diálogo
let alertPromptModal = null;
let _promptResolve = null;
let confirmModal = null;
let _confirmResolve = null;

// Referencias a los modales principales (inicializadas como null)
let previewModal = null;
let editModal = null;
let storeModal = null;
let storeListModal = null;

// --- Funciones de Inicialización ---

function init(mainCallbacks) {
    console.log("UI Module init (v4.20.2 - Reordered modal functions)");
    callbacks = mainCallbacks;

    _bindHeaderEvents();
    _bindNavEvents();
    _bindFooterEvents();
    _bindLoginEvents();
    _bindGlobalListeners();
    _bindCrumbieEvents();

    // Pre-crear modales principales AHORA, después de definir las funciones create...
    createPreviewModal();
    createEditModal();
    createStoreModal(); // Mover creación aquí
    createStoreListModal(); // Mover creación aquí
    createAlertPromptModal();
    createConfirmModal();
}

// ... (Las funciones _bind... no cambian) ...
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
        // Llama al controlador principal para que decida qué hacer
        if (callbacks.onCrumbieClick) {
            callbacks.onCrumbieClick();
        }
    });
}

function _bindLoginEvents() {
    const header = document.querySelector('header');
    header?.addEventListener('click', (e) => {
        const loginBtn = e.target.closest('#login-btn');
        const userInfo = e.target.closest('#user-info');

        if (loginBtn) {
            const action = loginBtn.dataset.action;
            if (action === 'login' && callbacks.onLogin) {
                callbacks.onLogin();
            }
        } else if (userInfo && callbacks.onLogout) {
            callbacks.onLogout();
        }
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

// --- Funciones de Renderizado Principal ---
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
        _createLoginButton(true, loginBtnContainer);
    } else {
        userInfo.style.display = 'none';
        _createLoginButton(false, loginBtnContainer);
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

        btn.addEventListener('click', () => {
            if (callbacks.onDayClick) callbacks.onDayClick(dia);
        });

        grid.appendChild(btn);
    });

    appContent.innerHTML = '';
    appContent.appendChild(grid);
}

function updateSpotlight(dateString, dayName, memories) {
    const titleEl = document.getElementById('spotlight-date-header');
    const listEl = document.getElementById('today-memory-spotlight'); // This is the main box

    if (titleEl) titleEl.textContent = dateString; // Solo la fecha
    if (!listEl) return;

    listEl.innerHTML = ''; // Limpiar la caja principal

    // 1. Añadir el nombre del día (si existe)
    if (dayName) {
        const dayNameEl = document.createElement('h3');
        dayNameEl.className = 'spotlight-day-name';
        dayNameEl.textContent = `- ${dayName} -`;
        listEl.appendChild(dayNameEl);
    }

    // 2. Crear el contenedor para las memorias
    const containerEl = document.createElement('div');
    containerEl.id = 'spotlight-memories-container';
    listEl.appendChild(containerEl);


    if (!memories || memories.length === 0) {
        const placeholder = document.createElement('p');
        placeholder.className = 'list-placeholder';
        placeholder.textContent = 'No hay memorias destacadas.';
        containerEl.appendChild(placeholder);
        return;
    }

    // 3. Añadir memorias al contenedor
    memories.forEach(mem => {
        const itemEl = document.createElement('div');
        itemEl.className = 'spotlight-memory-item';

        // Añadir clase para truncado CSS
        if (mem.Tipo === 'Texto') {
            itemEl.classList.add('spotlight-item-text');
        }

        itemEl.innerHTML = createMemoryItemHTML(mem, false); // createMemoryItemHTML debe estar definida antes

        itemEl.addEventListener('click', () => {
             const diaObj = _allDaysData.find(d => d.id === mem.diaId);
             if (diaObj && callbacks.onDayClick) {
                 callbacks.onDayClick(diaObj);
            } else {
                console.warn("No se encontró el objeto 'dia' para el spotlight:", mem.diaId);
            }
        });

        containerEl.appendChild(itemEl);
    });
}


// --- INICIO: SECCIÓN DE FUNCIONES DE MODALES (REORDENADA) ---

// --- Modal: Vista Previa (Preview) ---
function createPreviewModal() {
    if (previewModal) return; // Evitar duplicados si init se llama > 1 vez

    previewModal = document.createElement('div');
    previewModal.id = 'preview-modal';
    previewModal.className = 'modal-preview';
    previewModal.innerHTML = `
        <div class="modal-preview-content">
            <div class="modal-preview-header">
                <h3 id="preview-title"></h3>
            </div>
            <div class="modal-preview-notebook-paper">
                <div class="modal-preview-memorias">
                    <h4 style="display: none;">Memorias:</h4>
                    <div id="preview-memorias-list">
                        <p class="list-placeholder preview-loading" style="display: none;">Cargando memorias...</p>
                    </div>
                </div>
            </div>
            <div class="modal-preview-footer">
                <button id="close-preview-btn" class="aqua-button">Cerrar</button>
                <button id="edit-from-preview-btn" class="aqua-button">Editar este día</button>
            </div>
        </div>`;
    document.body.appendChild(previewModal);

    // Bind events aquí para asegurar que los elementos existen
    document.getElementById('close-preview-btn')?.addEventListener('click', closePreviewModal);
    document.getElementById('edit-from-preview-btn')?.addEventListener('click', () => {
        if (callbacks.onEditFromPreview) {
            callbacks.onEditFromPreview();
        }
    });
}

function showPreviewLoading(isLoading) {
    const loadingEl = previewModal?.querySelector('.preview-loading'); // Usar previewModal directamente
    const listEl = previewModal?.querySelector('#preview-memorias-list');
    if (loadingEl && listEl) {
        if (isLoading) {
            listEl.innerHTML = ''; // Limpiar antes de mostrar loading
            loadingEl.style.display = 'block';
        } else {
            loadingEl.style.display = 'none';
        }
    }
}

function openPreviewModal(dia, memories) {
    if (!previewModal) createPreviewModal(); // Asegurar que existe
    _currentDay = dia;

    const titleEl = document.getElementById('preview-title');
    const listEl = document.getElementById('preview-memorias-list');

    const dayName = dia.Nombre_Especial !== 'Unnamed Day' ? ` (${dia.Nombre_Especial})` : '';
    if (titleEl) titleEl.textContent = `${dia.Nombre_Dia}${dayName}`;

    _renderMemoryList(listEl, memories, false); // _renderMemoryList debe estar definida

    previewModal.style.display = 'flex';
    setTimeout(() => previewModal.classList.add('visible'), 10);
}

function closePreviewModal() {
    if (!previewModal) return;
    previewModal.classList.remove('visible');
    setTimeout(() => {
        previewModal.style.display = 'none';
        _currentDay = null; // Limpiar día actual al cerrar
    }, 200);
}

// --- Modal: Edición (Edit/Add) ---
function createEditModal() {
    if (editModal) return;

    editModal = document.createElement('div');
    editModal.id = 'edit-add-modal';
    editModal.className = 'modal-edit';
    editModal.innerHTML = `
        <div class="modal-content">
            <div class="modal-preview-header">
                 <h3 id="edit-modal-title-dynamic">Añadir/Editar</h3>
            </div>
            <div class="modal-content-scrollable">
                <p class="list-placeholder edit-loading" style="display: none; padding: 20px;">Cargando...</p>
                <div class="edit-content-wrapper">
                    <div class="modal-section" id="day-selection-section" style="display: none;">
                        <h3>Añadir Memoria a...</h3>
                        <label for="edit-mem-day">Día (MM-DD):</label>
                        <div class="day-selection-controls">
                            <select id="edit-mem-day"></select>
                            <button type="button" id="btn-name-selected-day" class="aqua-button small" title="Nombrar Día Seleccionado">Nombrar</button>
                        </div>
                        <p id="add-name-status" class="status-message"></p>
                    </div>
                    <div class="modal-section" id="day-name-section" style="display: none;">
                        <h3 id="edit-modal-title"></h3>
                        <label for="nombre-especial-input">Nombrar este día:</label>
                        <input type="text" id="nombre-especial-input" placeholder="Ej. Día de la Pizza" maxlength="25">
                        <button id="save-name-btn" class="aqua-button">Guardar Nombre</button>
                        <p id="save-status" class="status-message"></p>
                    </div>

                    <div class="modal-section memorias-section">
                        <h4>Memorias</h4>
                        <div id="edit-memorias-list-container">
                            <div id="edit-memorias-list"></div>
                            <button type="button" id="btn-show-add-form" class="aqua-button">Añadir Nueva Memoria</button>
                        </div>

                        <form id="memory-form" style="display: none;">
                             <p class="section-description" id="memory-form-title">Añadir/Editar Memoria</p>
                            <label for="memoria-year">Año Original:</label>
                            <input type="number" id="memoria-year" placeholder="Año" min="1900" max="2100" required>
                            <label for="memoria-type">Tipo:</label>
                            <select id="memoria-type">
                                <option value="Texto">Nota</option>
                                <option value="Lugar">Lugar</option>
                                <option value="Musica">Canción</option>
                            </select>
                            <div class="add-memory-input-group" id="input-type-Texto">
                                <label for="memoria-desc">Descripción:</label>
                                <textarea id="memoria-desc" placeholder="Escribe tu recuerdo..."></textarea>
                            </div>
                            <div class="add-memory-input-group" id="input-type-Lugar">
                                <label for="memoria-place-search">Buscar Lugar:</label>
                                <input type="text" id="memoria-place-search" placeholder="Ej. Torre Eiffel">
                                <button type="button" class="aqua-button" id="btn-search-place">Buscar</button>
                                <div id="place-results" class="search-results"></div>
                            </div>
                            <div class="add-memory-input-group" id="input-type-Musica">
                                <label for="memoria-music-search">Buscar Canción:</label>
                                <input type="text" id="memoria-music-search" placeholder="Ej. Bohemian Rhapsody">
                                <button type="button" class="aqua-button" id="btn-search-itunes">Buscar</button>
                                <div id="itunes-results" class="search-results"></div>
                            </div>
                            <button type="submit" id="save-memoria-btn" class="aqua-button">Añadir Memoria</button>
                            <button type="button" id="btn-cancel-mem-edit" class="aqua-button small">Cancelar</button>
                            <p id="memoria-status" class="status-message"></p>
                        </form>
                    </div>
                </div>
            </div>
            <div class="modal-main-buttons">
                <button id="close-edit-add-btn" class="aqua-button">Cerrar</button>
            </div>
        </div>
    `;
    document.body.appendChild(editModal);

    // Mover _bindEditModalEvents aquí para asegurar que los elementos existen
    _bindEditModalEvents();
}

function showEditLoading(isLoading) {
    const loadingEl = editModal?.querySelector('.edit-loading');
    const contentWrapper = editModal?.querySelector('.edit-content-wrapper');
    if (loadingEl && contentWrapper) {
        loadingEl.style.display = isLoading ? 'block' : 'none';
        contentWrapper.style.display = isLoading ? 'none' : 'block';
    }
}

async function handleNameSelectedDay() { // Async para usar showPrompt
     if (!callbacks.onSaveDayName || !_allDaysData) return;

     const daySelect = document.getElementById('edit-mem-day');
     if (!daySelect) return;
     const selectedDayId = daySelect.value;
     const selectedOption = daySelect.options[daySelect.selectedIndex];
     const selectedDayText = selectedOption ? selectedOption.text : selectedDayId;

     const currentDayData = _allDaysData.find(d => d.id === selectedDayId);
     const currentName = currentDayData?.Nombre_Especial !== 'Unnamed Day' ? currentDayData.Nombre_Especial : '';

     const newName = await showPrompt(`Nombrar día ${selectedDayText}:`, currentName); // showPrompt debe estar definida

     if (newName !== null) {
        callbacks.onSaveDayName(selectedDayId, newName.trim(), 'add-name-status');
     }
}

function _bindEditModalEvents() {
    // Asegurar que los listeners se añaden DESPUÉS de crear el HTML
    document.getElementById('close-edit-add-btn')?.addEventListener('click', closeEditModal);
    document.getElementById('save-name-btn')?.addEventListener('click', () => {
        if (callbacks.onSaveDayName && _currentDay) {
            const input = document.getElementById('nombre-especial-input');
            callbacks.onSaveDayName(_currentDay.id, input.value.trim(), 'save-status');
        }
    });
    document.getElementById('btn-name-selected-day')?.addEventListener('click', handleNameSelectedDay);
    document.getElementById('btn-show-add-form')?.addEventListener('click', () => {
        resetMemoryForm(); // resetMemoryForm debe estar definida
        _showMemoryForm(true); // _showMemoryForm debe estar definida
    });
    document.getElementById('btn-cancel-mem-edit')?.addEventListener('click', () => {
        _showMemoryForm(false);
    });
    document.getElementById('memory-form')?.addEventListener('submit', _handleFormSubmit); // _handleFormSubmit debe estar definida
    document.getElementById('memoria-type')?.addEventListener('change', handleMemoryTypeChange); // handleMemoryTypeChange debe estar definida
    document.getElementById('btn-search-itunes')?.addEventListener('click', () => {
        if (callbacks.onSearchMusic) {
            const term = document.getElementById('memoria-music-search').value;
            if (term) callbacks.onSearchMusic(term);
        }
    });
    document.getElementById('btn-search-place')?.addEventListener('click', () => {
        if (callbacks.onSearchPlace) {
            const term = document.getElementById('memoria-place-search').value;
            if (term) callbacks.onSearchPlace(term);
        }
    });

    const listEl = document.getElementById('edit-memorias-list');
    listEl?.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.edit-btn');
        const deleteBtn = e.target.closest('.delete-btn');

        if (editBtn) {
            const memoriaId = editBtn.dataset.memoriaId;
            if (!memoriaId) { /*...*/ return; }
            if (_currentMemories?.length > 0) {
                const memToEdit = _currentMemories.find(m => m.id === memoriaId);
                if (memToEdit) {
                    fillFormForEdit(memToEdit); // fillFormForEdit debe estar definida
                } else { /*...*/ }
            }
        }
        if (deleteBtn) {
            const memoriaId = deleteBtn.dataset.memoriaId;
            if (!memoriaId) { /*...*/ return; }
            const mem = _currentMemories.find(m => m.id === memoriaId);
            if (mem && callbacks.onDeleteMemory) {
                 const dayIdToDeleteFrom = _currentDay ? _currentDay.id : document.getElementById('edit-mem-day')?.value;
                 if (dayIdToDeleteFrom) {
                    callbacks.onDeleteMemory(dayIdToDeleteFrom, mem);
                 } else { /*...*/ }
            } else { /*...*/ }
        }
    });
}

function _showMemoryForm(show) {
    const form = document.getElementById('memory-form');
    const listContainer = document.getElementById('edit-memorias-list-container');
    if (form) form.style.display = show ? 'block' : 'none';
    if (listContainer) listContainer.style.display = show ? 'none' : 'block';
}

function openEditModal(dia, memories, allDays) {
    if (!editModal) createEditModal();
    _currentDay = dia;
    _currentMemories = memories || [];
    _allDaysData = allDays || [];

    const daySelection = document.getElementById('day-selection-section');
    const dayNameSection = document.getElementById('day-name-section');
    const titleEl = document.getElementById('edit-modal-title');
    const nameInput = document.getElementById('nombre-especial-input');
    const daySelect = document.getElementById('edit-mem-day');
    const dynamicTitleEl = document.getElementById('edit-modal-title-dynamic');
    const formTitle = document.getElementById('memory-form-title');

    if (dia) { // Modo Editar
        daySelection.style.display = 'none';
        dayNameSection.style.display = 'block';
        if (dynamicTitleEl) dynamicTitleEl.textContent = 'Editar Día';
        if (formTitle) formTitle.textContent = 'Añadir/Editar Memoria';
        const dayName = dia.Nombre_Especial !== 'Unnamed Day' ? ` (${dia.Nombre_Especial})` : '';
        titleEl.textContent = `Editando: ${dia.Nombre_Dia}${dayName}`;
        nameInput.value = dia.Nombre_Especial !== 'Unnamed Day' ? dia.Nombre_Especial : '';
    } else { // Modo Añadir
        daySelection.style.display = 'block';
        dayNameSection.style.display = 'none';
        if (dynamicTitleEl) dynamicTitleEl.textContent = 'Añadir Memoria';
        if (formTitle) formTitle.textContent = 'Añadir Memoria';
        if (_allDaysData.length > 0 && daySelect) {
            daySelect.innerHTML = '';
             _allDaysData.sort((a, b) => a.id.localeCompare(b.id)).forEach(d => {
                const opt = document.createElement('option');
                opt.value = d.id;
                const displayName = d.Nombre_Especial !== 'Unnamed Day' ? `${d.Nombre_Dia} (${d.Nombre_Especial})` : d.Nombre_Dia;
                opt.textContent = displayName;
                daySelect.appendChild(opt);
            });
            const today = new Date();
            const todayId = `${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
            daySelect.value = todayId; // Establecer valor después de añadir opciones
        }
    }

    _showMemoryForm(false);
    resetMemoryForm(); // resetMemoryForm debe estar definida

    _renderMemoryList(document.getElementById('edit-memorias-list'), _currentMemories, true);

    showModalStatus('save-status', '', false); // showModalStatus debe estar definida
    showModalStatus('memoria-status', '', false);
    showModalStatus('add-name-status', '', false);
    showEditLoading(false);

    editModal.style.display = 'flex';
    setTimeout(() => editModal.classList.add('visible'), 10);
}

function closeEditModal() {
    if (!editModal) return;
    editModal.classList.remove('visible');
    setTimeout(() => {
        editModal.style.display = 'none';
        _currentDay = null;
        _currentMemories = [];
        _isEditingMemory = false;
    }, 200);
}

// --- Modales Almacén (Store) ---
function createStoreModal() {
    if (storeModal) return;
    storeModal = document.createElement('div');
    storeModal.id = 'store-modal';
    storeModal.className = 'modal-store';

    const categories = [
        { type: 'Nombres', icon: 'label', label: 'Nombres de Día' },
        { type: 'Lugar', icon: 'place', label: 'Lugares' },
        { type: 'Musica', icon: 'music_note', label: 'Canciones' },
        { type: 'Texto', icon: 'article', label: 'Notas' }
    ];
    let buttonsHTML = categories.map(cat => createStoreCategoryButton(cat.type, cat.icon, cat.label)).join(''); // createStoreCategoryButton debe estar definida

    storeModal.innerHTML = `
        <div class="modal-content">
            <div class="modal-preview-header"><h3>Almacén de Memorias</h3></div>
            <div class="modal-content-scrollable store-category-list">${buttonsHTML}</div>
            <div class="modal-main-buttons"><button id="close-store-btn" class="aqua-button">Cerrar</button></div>
        </div>`;
    document.body.appendChild(storeModal);

    document.getElementById('close-store-btn')?.addEventListener('click', closeStoreModal); // closeStoreModal debe estar definida
    storeModal.querySelector('.store-category-list')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.store-category-button');
        if (btn && callbacks.onStoreCategoryClick) {
            callbacks.onStoreCategoryClick(btn.dataset.type);
        }
    });
}

function openStoreModal() { // <-- ESTA ES LA FUNCIÓN PROBLEMÁTICA
    if (!storeModal) createStoreModal(); // Llama a createStoreModal
    storeModal.style.display = 'flex';
    setTimeout(() => storeModal.classList.add('visible'), 10);
}

function closeStoreModal() {
    if (!storeModal) return;
    storeModal.classList.remove('visible');
    setTimeout(() => storeModal.style.display = 'none', 200);
}

// --- Modales Lista Almacén (Store List) ---
function createStoreListModal() {
    if (storeListModal) return;
    storeListModal = document.createElement('div');
    storeListModal.id = 'store-list-modal';
    storeListModal.className = 'modal-store-list';
    storeListModal.innerHTML = `
        <div class="modal-content">
            <div class="modal-preview-header"><h3 id="store-list-title">Resultados</h3></div>
            <div class="modal-content-scrollable" id="store-list-content"><p class="list-placeholder">Cargando...</p></div>
            <div class="modal-main-buttons"><button id="close-store-list-btn" class="aqua-button">Volver</button></div>
        </div>`;
    document.body.appendChild(storeListModal);
    _bindStoreListModalEvents(); // _bindStoreListModalEvents debe estar definida
}

function _bindStoreListModalEvents() {
    document.getElementById('close-store-list-btn')?.addEventListener('click', closeStoreListModal); // closeStoreListModal debe estar definida
    const contentEl = document.getElementById('store-list-content');
    contentEl?.addEventListener('click', (e) => {
        const loadMoreBtn = e.target.closest('#load-more-btn');
        if (loadMoreBtn && callbacks.onStoreLoadMore) {
            loadMoreBtn.disabled = true;
            loadMoreBtn.textContent = 'Cargando...';
            callbacks.onStoreLoadMore();
            return;
        }
        const itemEl = e.target.closest('.store-list-item');
        if (itemEl && callbacks.onStoreItemClick) {
            callbacks.onStoreItemClick(itemEl.dataset.diaId);
        }
    });
}

function openStoreListModal(title) {
    if(!storeListModal) createStoreListModal();
    const titleEl = document.getElementById('store-list-title');
    const contentEl = document.getElementById('store-list-content');
    if (titleEl) titleEl.textContent = title;
    if (contentEl) contentEl.innerHTML = '<p class="list-placeholder">Cargando...</p>';
    storeListModal.style.display = 'flex';
    setTimeout(() => storeListModal.classList.add('visible'), 10);
}

function closeStoreListModal() {
    if (!storeListModal) return;
    storeListModal.classList.remove('visible');
    setTimeout(() => storeListModal.style.display = 'none', 200);
}

function updateStoreList(items, append = false, hasMore = false) {
    const contentEl = document.getElementById('store-list-content');
    if (!contentEl) return;
    const placeholder = contentEl.querySelector('.list-placeholder');
    if (placeholder) placeholder.remove();
    const loadMoreBtn = contentEl.querySelector('#load-more-btn');
    if (loadMoreBtn) loadMoreBtn.remove();
    if (!append && (!items || items.length === 0)) {
        contentEl.innerHTML = '<p class="list-placeholder">No se encontraron resultados.</p>';
        return;
    }
    if (!append) contentEl.innerHTML = '';
    const fragment = document.createDocumentFragment();
    items.forEach(item => {
        const itemEl = createStoreListItem(item); // createStoreListItem debe estar definida
        fragment.appendChild(itemEl);
    });
    contentEl.appendChild(fragment);
    if (hasMore) {
        const btn = document.createElement('button');
        btn.id = 'load-more-btn';
        btn.className = 'aqua-button';
        btn.textContent = 'Cargar Más (+10)';
        contentEl.appendChild(btn);
    } else if (items.length > 0 && !append) { // Evitar mensaje si se está añadiendo
        const end = document.createElement('p');
        end.className = 'list-placeholder';
        end.textContent = 'Fin de los resultados.';
        contentEl.appendChild(end);
    }
}


// --- Modales Alerta, Prompt, Confirmación ---
function createAlertPromptModal() {
    if (alertPromptModal) return;
    alertPromptModal = document.createElement('div');
    alertPromptModal.id = 'alert-prompt-modal';
    alertPromptModal.className = 'modal-alert-prompt';
    alertPromptModal.innerHTML = `
        <div class="modal-alert-content">
            <p id="alert-prompt-message"></p>
            <input type="text" id="alert-prompt-input" style="display: none;">
            <div class="modal-main-buttons">
                <button id="alert-prompt-cancel" style="display: none;">Cancelar</button>
                <button id="alert-prompt-ok">OK</button>
            </div>
        </div>`;
    document.body.appendChild(alertPromptModal);
    _bindAlertPromptEvents(); // _bindAlertPromptEvents debe estar definida
}

function _bindAlertPromptEvents() {
    document.getElementById('alert-prompt-ok')?.addEventListener('click', () => closeAlertPromptModal(true)); // closeAlertPromptModal debe estar definida
    document.getElementById('alert-prompt-cancel')?.addEventListener('click', () => closeAlertPromptModal(false));
}

function closeAlertPromptModal(isOk) {
    if (!alertPromptModal) return;
    alertPromptModal.classList.remove('visible');
    setTimeout(() => {
        alertPromptModal.style.display = 'none';
        alertPromptModal.querySelector('.modal-alert-content').classList.remove('settings-alert', 'search-alert');
    }, 200);
    if (_promptResolve) {
        const input = document.getElementById('alert-prompt-input');
        _promptResolve(isOk ? input.value : null);
        _promptResolve = null;
    }
}

function showAlert(message, type = 'default') {
    if(!alertPromptModal) createAlertPromptModal();
    const contentEl = alertPromptModal.querySelector('.modal-alert-content');
    contentEl.classList.remove('settings-alert', 'search-alert');
    if (type === 'settings') contentEl.classList.add('settings-alert');
    document.getElementById('alert-prompt-message').textContent = message;
    document.getElementById('alert-prompt-input').style.display = 'none';
    document.getElementById('alert-prompt-cancel').style.display = 'none';
    document.getElementById('alert-prompt-ok').textContent = 'OK';
    alertPromptModal.style.display = 'flex';
    setTimeout(() => alertPromptModal.classList.add('visible'), 10);
    // showAlert no necesita devolver promesa
}

function showPrompt(message, defaultValue = '', type = 'default') {
    if(!alertPromptModal) createAlertPromptModal();
    const contentEl = alertPromptModal.querySelector('.modal-alert-content');
    contentEl.classList.remove('settings-alert', 'search-alert');
    if (type === 'search') contentEl.classList.add('search-alert');
    document.getElementById('alert-prompt-message').textContent = message;
    const input = document.getElementById('alert-prompt-input');
    input.style.display = 'block';
    input.value = defaultValue;
    document.getElementById('alert-prompt-cancel').style.display = 'block';
    document.getElementById('alert-prompt-ok').textContent = 'OK';
    alertPromptModal.style.display = 'flex';
    setTimeout(() => alertPromptModal.classList.add('visible'), 10);
    return new Promise((resolve) => { _promptResolve = resolve; });
}

function createConfirmModal() {
    if (confirmModal) return;
    confirmModal = document.createElement('div');
    confirmModal.id = 'confirm-modal';
    confirmModal.className = 'modal-confirm';
    confirmModal.innerHTML = `
        <div class="modal-alert-content">
            <p id="confirm-message"></p>
            <div class="modal-main-buttons">
                <button id="confirm-cancel">Cancelar</button>
                <button id="confirm-ok" class="delete-confirm">Borrar</button>
            </div>
        </div>`;
    document.body.appendChild(confirmModal);
    _bindConfirmModalEvents(); // _bindConfirmModalEvents debe estar definida
}

function _bindConfirmModalEvents() {
    document.getElementById('confirm-ok')?.addEventListener('click', () => closeConfirmModal(true)); // closeConfirmModal debe estar definida
    document.getElementById('confirm-cancel')?.addEventListener('click', () => closeConfirmModal(false));
}

function closeConfirmModal(isConfirmed) {
    if (!confirmModal) return;
    confirmModal.classList.remove('visible');
    setTimeout(() => { confirmModal.style.display = 'none'; }, 200);
    if (_confirmResolve) {
        _confirmResolve(isConfirmed);
        _confirmResolve = null;
    }
}

function showConfirm(message) {
     if(!confirmModal) createConfirmModal();
    document.getElementById('confirm-message').textContent = message;
    confirmModal.style.display = 'flex';
    setTimeout(() => confirmModal.classList.add('visible'), 10);
    return new Promise((resolve) => { _confirmResolve = resolve; });
}

// --- FIN: SECCIÓN DE FUNCIONES DE MODALES ---


// --- Funciones de Ayuda (Helpers) de UI ---
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
        itemEl.innerHTML = createMemoryItemHTML(mem, showActions); // createMemoryItemHTML debe estar definida
        fragment.appendChild(itemEl);
    });
    listEl.appendChild(fragment);
}

function updateMemoryList(memories) {
    _currentMemories = memories || [];
    const editList = document.getElementById('edit-memorias-list');
    if (editList) _renderMemoryList(editList, _currentMemories, true);
    const previewList = document.getElementById('preview-memorias-list');
    if (previewList && previewModal?.classList.contains('visible') && _currentDay) {
         _renderMemoryList(previewList, _currentMemories, false);
    }
}

function createMemoryItemHTML(mem, showActions) {
    if (!mem) return '';
    const memId = mem.id || ''; // Usar '' si no hay id

    let yearStr = 'Año desc.';
    if (mem.Fecha_Original) {
        try {
            const date = new Date(mem.Fecha_Original.seconds * 1000 || mem.Fecha_Original);
            if (!isNaN(date)) yearStr = date.getFullYear(); // Verificar fecha válida
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
        const memoryHTML = createMemoryItemHTML(item, false);
        contentHTML = `${memoryHTML}<div class="store-item-day-ref">${item.Nombre_Dia}</div>`;
    }
    itemEl.innerHTML = contentHTML;
    return itemEl;
}

function _createLoginButton(isLoggedIn, container) { // Cambiado a isLoggedIn para claridad
    if (!container) return;
    const btn = document.createElement('button');
    btn.id = 'login-btn';
    btn.className = 'header-login-btn';
    if (isLoggedIn) { // Si está logueado, mostrar botón de logout
        btn.title = 'Cerrar sesión';
        btn.dataset.action = 'logout'; // Identificar acción para el listener
        btn.innerHTML = `<span class="material-icons-outlined">logout</span>`;
    } else { // Si no está logueado, mostrar botón de login
        btn.title = 'Iniciar sesión con Google';
        btn.dataset.action = 'login';
        btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg"><path fill="#4285F4" d="M17.64 9.20455c0-.63864-.05727-1.25182-.16909-1.84091H9v3.48182h4.84364c-.20864 1.125-.84273 2.07818-1.77727 2.71136v2.25818h2.90864c1.70182-1.56682 2.68409-3.87409 2.68409-6.61045z"/><path fill="#34A853" d="M9 18c2.43 0 4.47182-.80591 5.96273-2.18045l-2.90864-2.25818c-.80591.54364-1.83682.86591-2.94.86591-2.27318 0-4.20727-1.53318-4.9-3.58227H1.07182v2.33318C2.56636 16.3 5.56 18 9 18z"/><path fill="#FBBC05" d="M4.1 10.71c-.22-.64-.35-1.32-.35-2.03s.13-.139.35-2.03V4.31H1.07C.38 5.67 0 7.29 0 9.03s.38 3.36 1.07 4.72l3.03-2.33v.03z"/><path fill="#EA4335" d="M9 3.57955c1.32136 0 2.50773.45455 3.44091 1.34591l2.58136-2.58136C13.46318.891364 11.4259 0 9 0 5.56 0 2.56636 1.70182 1.07182 4.31l3.02818 2.33318C4.79273 5.11273 6.72682 3.57955 9 3.57955z"/></svg>`;
    }
    container.innerHTML = ''; // Limpiar antes de añadir
    container.appendChild(btn);
}


// --- Lógica del Formulario (Resultados API, Submit, Reset, Edit) ---
// MOVIDAS Arriba: showMusicResults, showPlaceResults

let _selectedMusic = null;
let _selectedPlace = null;

function _handleFormSubmit(e) {
    e.preventDefault();
    if (callbacks.onSaveMemory) {
        const saveBtn = document.getElementById('save-memoria-btn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Guardando...';

        let diaId;
        if (_currentDay) { // Modo Editar
             diaId = _currentDay.id;
        } else { // Modo Añadir
            diaId = document.getElementById('edit-mem-day').value;
            // No buscar _currentDay aquí, dejar que main.js lo maneje si es necesario
            if(!diaId) { // Verificar si hay un día seleccionado
                console.error("Error crítico: No se seleccionó ningún día.");
                showModalStatus('memoria-status', 'Error: Día no seleccionado.', true);
                 saveBtn.disabled = false; saveBtn.textContent = 'Añadir Memoria';
                return;
            }
        }

        const form = document.getElementById('memory-form');
        const year = document.getElementById('memoria-year').value;
        const formData = {
            year: year ? parseInt(year) : null,
            Tipo: document.getElementById('memoria-type').value,
        };

        switch (formData.Tipo) {
            case 'Texto':
                formData.Descripcion = document.getElementById('memoria-desc').value;
                break;
            case 'Lugar':
                formData.LugarNombre = _selectedPlace ? _selectedPlace.name : document.getElementById('memoria-place-search').value;
                formData.LugarData = _selectedPlace ? _selectedPlace.data : null;
                break;
            case 'Musica':
                formData.CancionInfo = _selectedMusic ? `${_selectedMusic.trackName} - ${_selectedMusic.artistName}` : document.getElementById('memoria-music-search').value;
                formData.CancionData = _selectedMusic ? { trackId: _selectedMusic.trackId, trackName: _selectedMusic.trackName, artistName: _selectedMusic.artistName, artworkUrl60: _selectedMusic.artworkUrl60, trackViewUrl: _selectedMusic.trackViewUrl } : null;
                break;
        }
        // Pasar el ID del documento SOLO si estamos editando
        const docIdToEdit = _isEditingMemory ? form.dataset.editingId : null;
        callbacks.onSaveMemory(diaId, formData, docIdToEdit); // Pasar docIdToEdit en lugar de _isEditingMemory booleano
    }
}


function handleMemoryTypeChange() {
    const type = document.getElementById('memoria-type').value;
    ['Texto', 'Lugar', 'Musica'].forEach(id => {
        const el = document.getElementById(`input-type-${id}`);
        if (el) el.style.display = (id === type) ? 'block' : 'none';
    });
    if (type !== 'Musica') showMusicResults([]);
    if (type !== 'Lugar') showPlaceResults([]);
}

function fillFormForEdit(mem) {
    if (!mem || mem.Tipo === 'Imagen') return;
    resetMemoryForm();
    _isEditingMemory = true;
    const form = document.getElementById('memory-form');
    const saveBtn = document.getElementById('save-memoria-btn');
    const typeSelect = document.getElementById('memoria-type');
    form.dataset.editingId = mem.id; // Guardar ID del doc a editar
    saveBtn.textContent = 'Actualizar Memoria';
    if (mem.Fecha_Original) {
        try {
            const date = new Date(mem.Fecha_Original.seconds * 1000 || mem.Fecha_Original);
            if (!isNaN(date)) document.getElementById('memoria-year').value = date.getFullYear();
        } catch(e) { /* ignore */ }
    }
    const exists = Array.from(typeSelect.options).some(opt => opt.value === mem.Tipo);
    typeSelect.value = exists ? mem.Tipo : 'Texto';
    handleMemoryTypeChange();
    switch (mem.Tipo) {
        case 'Texto': document.getElementById('memoria-desc').value = mem.Descripcion || ''; break;
        case 'Lugar':
            document.getElementById('memoria-place-search').value = mem.LugarNombre || '';
            if (mem.LugarData) { _selectedPlace = { name: mem.LugarNombre, data: mem.LugarData }; showPlaceResults([mem.LugarData], true); }
            break;
        case 'Musica':
            document.getElementById('memoria-music-search').value = mem.CancionInfo || '';
            if (mem.CancionData) { _selectedMusic = mem.CancionData; showMusicResults([mem.CancionData], true); }
            break;
    }
    _showMemoryForm(true);
    document.querySelector('.modal-content-scrollable')?.scrollTo({ top: form.offsetTop, behavior: 'smooth' });
}


function resetMemoryForm() {
    _isEditingMemory = false;
    _selectedMusic = null;
    _selectedPlace = null;
    const form = document.getElementById('memory-form');
    if (!form) return;
    form.reset();
    document.getElementById('memoria-year').value = '';
    form.dataset.editingId = '';
    document.getElementById('save-memoria-btn').textContent = 'Añadir Memoria';
    document.getElementById('save-memoria-btn').disabled = false;
    showMusicResults([]);
    showPlaceResults([]);
    showModalStatus('memoria-status', '', false);
    handleMemoryTypeChange(); // Asegura que se muestra el campo correcto (Texto por defecto)
    _showMemoryForm(false); // Ocultar al resetear
}


function showModalStatus(elementId, message, isError) {
    const statusEl = document.getElementById(elementId);
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = isError ? 'status-message error' : 'status-message success';
    if (message && !isError) { // Auto-limpiar mensajes de éxito
        setTimeout(() => { if (statusEl.textContent === message) { statusEl.textContent = ''; statusEl.className = 'status-message'; } }, 3000);
    }
}

function showCrumbieAnimation(message) {
    if (document.querySelector('.crumbie-float-text')) return; // Evitar duplicados
    const textEl = document.createElement('div');
    textEl.className = 'crumbie-float-text';
    textEl.textContent = message;
    document.body.appendChild(textEl);
    textEl.addEventListener('animationend', () => textEl.remove()); // Simplificado
}


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
    showMusicResults, showPlaceResults, // Asegurar que están exportadas
    showModalStatus, handleMemoryTypeChange,
    showCrumbieAnimation
};
