const socket = io();
let modoSeleccionado = "";
const listaSalas = new Map();

console.log("Menú de inicio listo.");


const seleccionarModo = function (modo) {
    // Se guardan los dos botones en variables. Así como el modo de juego seleccionado.
    const botonBomba = document.getElementById("modoBomba"),
    botonTrivial = document.getElementById("modoTrivial"),
    botonCrear = document.getElementById("botonCrear"),
    elementoSeleccionado = document.getElementById("modo" + modo); // Puede ser o Bomba o Trivial.
    // Lógica de deselección de botones.
    // Si el modo seleccionado es EXACTAMENTE igual a "" (nada), se ejecuta el if.
    if (modoSeleccionado === modo) {
        modoSeleccionado = "";
        // Se le quita el modo seleccionado.
        botonBomba.classList.remove("modoSeleccionado") || botonTrivial.classList.remove("modoSeleccionado");
        botonCrear.disabled = true; 
        botonCrear.classList.remove("botonActivo"); 
        botonCrear.classList.add("botonDesactivado");
        console.log("Modo deseleccionado...");
        return; // Return para que no ejecute otra vez el código de seleccionar botón.
    }

    if (modoSeleccionado === "Bomba") {
        botonTrivial.classList.add("modoSeleccionado");
        botonBomba.classList.remove("modoSeleccionado");
    }

    if (modoSeleccionado === "Trivial") {
        botonBomba.classList.add("modoSeleccionado");
        botonTrivial.classList.remove("modoSeleccionado");
    }

    // Lógica de selección de botones.
    modoSeleccionado = modo; // Sería bomba, o trivial.
    console.log("Modo seleccionado: " + modo);
    elementoSeleccionado.classList.add("modoSeleccionado");
    botonCrear.disabled = false; 
    botonCrear.classList.remove("botonDesactivado"); 
    botonCrear.classList.add("botonActivo");
};

const validarCodigo = function(codigoSala) {
    const botonUnirse = document.getElementById("botonUnirse");
    let codigoSalaLimpio = codigoSala.value.replace(/[^a-zA-Z]/g, "").toUpperCase();
    // Pone el código en mayúsculas en la pantalla del usuario. 
    codigoSala.value = codigoSalaLimpio; 
    
    if (!listaSalas.has(codigoSalaLimpio)) {
        botonUnirse.disabled = true;
        botonUnirse.classList.remove("botonActivo");
        botonUnirse.classList.add("botonDesactivado");
        return;
    }

    botonUnirse.disabled = false;
    botonUnirse.classList.remove("botonDesactivado");
    botonUnirse.classList.add("botonActivo");
    console.log("Código validado...");
    return;
};

const crearSala = () => {
    const letras = "THEQUICKBROWNFOXJUMPSOVERTHELAZYDOG";
    let codigo = "";

    const crearCodigo = () => {
        codigo = "";
        for (let i = 0; i < 4; i++) {
            codigo += letras.charAt(Math.floor(Math.random() * letras.length));
        }

        if (listaSalas.has(codigo)) {
            crearCodigo();
        }
    }

    crearCodigo();

    // Guarda en el modo de juego en la memoria del navegador.
    localStorage.setItem("modo-juego", modoSeleccionado); 
    console.log(`Creando la sala ${codigo}...`);
    window.location.href = `/${modoSeleccionado.toLowerCase()}?sala=${codigo}`; 
};

const unirseASalaManual = function(clic) {
    if (clic) clic.preventDefault();
    const input = document.getElementById("inputCodigo");

    const codigo = input.value.toUpperCase().trim();
    
    if (listaSalas.has(codigo)) {
        modoSeleccionado = listaSalas.get(codigo); 
        window.location.href = `/${modoSeleccionado.toLowerCase()}?sala=${codigo}`;
    }
};

socket.on("lista-salas-actualizada", salas => {
    const contenedor = document.getElementById("salasPublicas");
    contenedor.innerHTML = "";
    listaSalas.clear(); // Se reinician las salas para que no queden residuos... 
    // El servidor les pasa a TODOS los jugadores las salas nuevas, entonces si se está jugando una partida de bomba y te pasan los jugadores te da igual...
    // Así que si en tu página no hay un "contenedor" se ignora la lista de nuevos jugadores. 
    if (!contenedor) return;
    
    if (salas.length === 0) {
        contenedor.innerHTML = "<div>No hay salas activas...</div>";
        return;
    }

    salas.forEach(sala => {
        const nombreModo = sala.modoJuego;
        const divSala = document.createElement("div");
        divSala.className = "tarjetaSalaPublica";
        divSala.innerHTML = `
        <div class="salaModo">MODO: <b>${nombreModo.toUpperCase()}</b></div> 
        <div class="codigoSala">CÓDIGO: <b>${sala.codigo}</b></div>
        <div class="creadorSala">Sala de ${sala.creador} (${sala.jugadores} Jugadores)</div>
        <button onclick="window.location.href='/${nombreModo.toLowerCase()}?sala=${sala.codigo}'" class="botonEntrar">ENTRAR</button>
        `;
        contenedor.appendChild(divSala);
        listaSalas.set(sala.codigo, nombreModo);
    });

    console.log("Lista actualizada...")
    // console.log(listaSalas)
});