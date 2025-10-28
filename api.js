/* api.js */
/* Módulo para gestionar llamadas a APIs externas (iTunes, Nominatim) */
/* (v1.4 - Cambiado proxy a cors.eu.org) */

/**
 * Busca canciones en la API de iTunes.
 * @param {string} term - El término de búsqueda.
 * @returns {Promise<object>} La respuesta JSON de la API.
 */
export async function searchiTunes(term) {
    // CAMBIO: Se usa un proxy CORS diferente ('cors.eu.org')
    const proxy = 'https://cors.eu.org/';
    
    // La URL de iTunes que queremos consultar
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=5`;
    
    // La URL final para cors.eu.org (no se codifica la URL de iTunes)
    const fetchUrl = proxy + url;
    
    try {
        const response = await fetch(fetchUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // Este proxy debería devolver JSON directamente
        return await response.json(); 

    } catch (error) {
        console.error('iTunes API Error:', error);
        if (error instanceof SyntaxError) {
             throw new Error("Error al parsear la respuesta del proxy. El proxy puede estar caído o la respuesta de iTunes fue inválida.");
        }
        // Si el fetch falla (como el ERR_NAME_NOT_RESOLVED) o el proxy falla
        throw new Error(`Fallo en la API/Proxy: ${error.message}`);
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
