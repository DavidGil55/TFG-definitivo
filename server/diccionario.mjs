import fs from "node:fs";
import path from "node:path";

const diccionario = new Set(); // Se guardan las palabras del diccionario en un set porque el set no permite duplicados.

// Esta función permite limpiar una palabra e introducirla al set del diccionario si su longitud es igual o mayor a dos.
function limpiarPalabra(palabra) {
    const palabraLimpia = palabra.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (palabraLimpia.length >= 2) diccionario.add(palabraLimpia);
}

// Esta función genera dos letras seguidas de una palabra elegida aleatoriamente sacada del diccionario. 
function generarDosLetras() {
    const palabraAzar = diccionarioArray[Math.floor(Math.random() * diccionarioArray.length)];
    const rangoPalabra = palabraAzar.length - 1;
    const inicio = Math.floor(Math.random() * rangoPalabra);
    return palabraAzar.substring(inicio, inicio + 2).toUpperCase();
}

// Se leen los datos del diccionario de forma SÍNCRONA.
// Entonces el programa se detiene hasta que  se lean todos los datos.
const datos = fs.readFileSync(path.join("diccionario.txt"), "utf-8");

const datosSucios = datos.split("\n");
datosSucios.forEach(limpiarPalabra);

// Ahora se puede guardar el set del diccionario en un array para usos futuros.
const diccionarioArray = Array.from(diccionario);
console.log(`Diccionario cargado: ${diccionario.size} palabras en total.`);
// console.log(diccionario);

export { diccionario, diccionarioArray, generarDosLetras };