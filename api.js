/* api.js */
/* Módulo para gestionar llamadas a APIs externas (iTunes, Nominatim) */
/* (v1.3 - Revertido a allorigins.win con endpoint .get) */

/**
 * Busca canciones en la API de iTunes.
 * @param {string} term - El término de búsqueda.
 * @returns {Promise<object>} La respuesta JSON de la API.
 */
export async function searchiTunes(term) {
    // CAMBIO: Volver a allorigins, pero usando el endpoint .get?url= que es más estable
    const proxy = 'https://api.allorigins.win/get?url=';
    
    // La URL de iTunes que queremos consultar
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=5`;
    
    // La URL de iTunes DEBE estar codificada para allorigins
    const fetchUrl = proxy + encodeURIComponent(url);
    
    try {
        const response = await fetch(fetchUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // allorigins envuelve la respuesta en su propio JSON
        const data = await response.json();
        
        if (!data.contents) {
             throw new Error("Respuesta inválida del proxy (no se encontró 'contents').");
        }
        
        // El contenido (data.contents) es el JSON de iTunes, pero como string. Hay que parsearlo.
        return JSON.parse(data.contents);

    } catch (error) {
        console.error('iTunes API Error:', error);
        if (error instanceof SyntaxError) {
             throw new Error("Error al parsear la respuesta de iTunes (data.contents).");
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
