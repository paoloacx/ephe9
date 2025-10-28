/* api.js */
/* Módulo para gestionar llamadas a APIs externas (iTunes, Nominatim) */
/* (v1.2 - Cambiado proxy de iTunes por 'thingproxy') */

/**
 * Busca canciones en la API de iTunes.
 * @param {string} term - El término de búsqueda.
 * @returns {Promise<object>} La respuesta JSON de la API.
 */
export async function searchiTunes(term) {
    // CAMBIO: Se usa un proxy CORS diferente ('thingproxy')
    const proxy = 'https://thingproxy.freeboard.io/fetch/';
    
    // La URL de iTunes que queremos consultar
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=5`;
    
    // La URL final para thingproxy (no se codifica la URL de iTunes)
    const fetchUrl = proxy + url;
    
    try {
        const response = await fetch(fetchUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        // thingproxy devuelve JSON directamente
        return await response.json(); 
    } catch (error) {
        console.error('iTunes API Error:', error);
        // Si el error es de parseo, puede que thingproxy fallara
        if (error instanceof SyntaxError) {
             throw new Error("Error al parsear la respuesta del proxy. El proxy puede estar caído.");
        }
        throw error; // Lanza el error para que el controlador lo coja
    }
}

/**
 * Busca lugares en la API de Nominatim (OpenStreetMap).
 * @param {string} term - El término de búsqueda.
 * @returns {Promise<object>} La respuesta JSON de la API.
 */
export async function searchNominatim(term) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(term)}&limit=5`;
    
    try {
        const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Nominatim API Error:', error);
        throw error; // Lanza el error para que el controlador lo coja
    }
}
