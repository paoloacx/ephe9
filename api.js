/* api.js */
/* Módulo para gestionar llamadas a APIs externas (iTunes, Nominatim) */
/* (v1.1 - Cambiado proxy de iTunes) */

/**
 * Busca canciones en la API de iTunes.
 * @param {string} term - El término de búsqueda.
 * @returns {Promise<object>} La respuesta JSON de la API.
 */
export async function searchiTunes(term) {
    // CAMBIO: Se usa un proxy CORS diferente y más estable
    const proxy = 'https://api.allorigins.win/raw?url=';
    
    // La URL de iTunes que queremos consultar
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=5`;
    
    // La URL final debe tener la URL de iTunes codificada como un parámetro para el proxy
    const fetchUrl = proxy + encodeURIComponent(url);
    
    try {
        const response = await fetch(fetchUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        // allorigins devuelve el JSON como texto plano, necesitamos parsearlo
        const textData = await response.text();
        return JSON.parse(textData); 
    } catch (error) {
        console.error('iTunes API Error:', error);
        // Si el error es de parseo, puede que allorigins fallara
        if (error instanceof SyntaxError) {
             throw new Error("Error al parsear la respuesta del proxy. Inténtalo de nuevo.");
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
