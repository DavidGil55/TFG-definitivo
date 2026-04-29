const socket = io();

// Elementos del HTML
const contadorCentral = document.getElementById("temporizador"),
    textoSilaba = document.getElementById("silaba"),
    contenedorJugadores = document.getElementById("contenedorJugadores"),
    inputPalabra = document.getElementById("inputPalabra"),
    inputChat = document.getElementById("inputChat"),
    mensajesChat = document.getElementById("mensajesChat"),
    tituloSala = document.getElementById("codigoSala"),
    logJuego = document.getElementById("logJuego"),
    botonRevancha = document.getElementById("botonRevancha"),
    botonCambio = document.getElementById("cambioChat"),
    infoSalaEstado = document.getElementById("infoSalaEstado"),
    botonSalir = document.getElementById("botonSalir");

// Aquí se obtiene el código de la sala mediante el URL.
const parametrosURL = new URLSearchParams(window.location.search);
const codigoSala = parametrosURL.get("sala");

let pedirInfo = "";
botonCambio.addEventListener("click", () => {
    if (mensajesChat.style.display !== "none") {
        mensajesChat.style.display = "none";
        infoSalaEstado.style.display = "block";
        botonCambio.innerText = "Volver al chat"
        inputChat.style.display = "none";

        pedirInfo = setInterval(() => {
            socket.emit("pedir-info-sala");
        }, 500);
        return;
    }
    mensajesChat.style.display = "block";
    infoSalaEstado.style.display = "none";
    inputChat.style.display = "block";
    botonCambio.innerText = "Ver información de la sala";
    clearInterval(pedirInfo); // Se detiene las peticions de información.
    pedirInfo = "";
});


// Unirse a la sala
function unirseSala(sala) {

    if (!sala) {
        window.location.href = "/";
        return;
    }

    const modoJuego = localStorage.getItem("modo-juego").toLowerCase();
    const codSala = sala.toUpperCase();
    tituloSala.innerText = "SALA: " + codSala;
    const apodoJugador = prompt(`Introduce tu apodo para la sala ${codSala}:`); // Prompt molesto.

    // Este if arregla que aunque le des al promp a la opción de cancelar aún te envía a la sala.
    // Ahora si le das a cancel sin haber puesto un nombre, te envía al lobby.
    if (apodoJugador === null) {
        window.location.href = "/";
        return;
    }

    console.log(`Uniéndose a sala: ${codSala}...`);
    // Este paquete luego será recibido por sockets.mjs en la línea ~9, y se leerá el código de la sala.
    socket.emit("unirse-sala", codSala, apodoJugador, modoJuego);
}

unirseSala(codigoSala);

// Salirse de la sala
botonSalir.addEventListener("click", () => {
    window.location.href = "/";
    // Esto es un poco inútil... 
    socket.disconnect();
});

// EVENTOS DE JUGADOR

// Enviar mensaje de chat
inputChat.addEventListener("keydown", evento => {
    if (evento.key === "Enter" && inputChat.value.trim() !== "") {
        socket.emit("enviar-chat", inputChat.value);
        inputChat.value = "";
    }
});


// Enviar palabra a la bomba
inputPalabra.addEventListener("keydown", evento => {
    if (evento.key === "Enter") {
        const palabra = inputPalabra.value.trim().toLowerCase();
        if (palabra.length > 0) {
            socket.emit("enviar-palabra", palabra);
            inputPalabra.value = "";
        }
    }
});

// Botón de Revancha
if (botonRevancha) {
    botonRevancha.addEventListener("click", () => {
        socket.emit("pedir-revancha");
        
        // Se cambia el texto para que se sepa que se ha pedido la revancha.
        botonRevancha.innerText = "ESPERANDO A OTRO JUGADOR...";
        botonRevancha.disabled = true; 
        botonRevancha.classList.add("botonDesactivado"); 
    });
}

// ACTUALIZACIONES DEL SERVIDOR 
socket.on("estado-juego", estado => {
    // El temporizador
    if (contadorCentral) {
        if (estado.enJuego || estado.preparando) {
            contadorCentral.innerText = estado.preparando ? "Esperando..." : estado.tiempo;
        } else {
            contadorCentral.innerText = "Esperando jugadores...";
            contadorCentral.style.fontSize = "2rem";
        }
    }

    // Las letras de la bomba
    if (textoSilaba) {
        if (estado.enJuego || estado.preparando) {
            textoSilaba.innerText = estado.silaba.toUpperCase();
        } else {
            textoSilaba.innerText = "--";
        }
    }

    // El círculo de los jugadores
    const jugadores = estado.jugadores;
    const nJugadores = jugadores.length;
    contenedorJugadores.innerHTML = "";

    jugadores.forEach((jugador, indice) => {

        const tarjetaJugador = document.createElement("div");
        tarjetaJugador.className = "tarjetaJugador";

        const radio = 250; // Si se pone 360 el primer jugador empieza en la derecha...
        const gradosJugador = 360 / nJugadores;
        const grados = indice * gradosJugador;
        // Se pasa de grados a radianes.
        const radianes = (grados * Math.PI / 180) - (Math.PI / 2);

        const x = Math.cos(radianes) * radio;
        const y = Math.sin(radianes) * radio;

        // Posicionamiento de la tarjeta
        tarjetaJugador.style.left = `calc(50% + ${x}px)`;
        tarjetaJugador.style.top = `calc(50% + ${y}px)`;
        tarjetaJugador.style.transform = "translate(-50%, -50%)";

        // Clases del CSS para el turno activo y si el jugador está muerto
        if (estado.enJuego && indice === estado.indiceTurno && jugador.vivo) {
            tarjetaJugador.classList.add("turnoActivo");
        }
        if (!jugador.vivo) {
            tarjetaJugador.classList.add("muerto");
        }

        const soyYo = jugador.id === socket.id;
        const corazones = "❤️".repeat(Math.max(0, jugador.vidas)) + "🖤".repeat(Math.max(0, 2 - jugador.vidas));

        tarjetaJugador.innerHTML = `
            <div class="jugadorIcono">👤</div>
            <div class="jugadorInfo">
                <div class="jugadorNombre">${jugador.nombre} ${soyYo ? "(TÚ)" : ""}</div> 
                <div class="jugadorVidas">${corazones}</div>
            </div>
        `;
        contenedorJugadores.appendChild(tarjetaJugador);
    });

    // Gestión de las palabras enviadas a la bomba

    if (estado.enJuego && !estado.preparando && nJugadores > 0) {
        const jugadorTurno = jugadores[estado.indiceTurno];
        const esMiTurno = jugadorTurno && (jugadorTurno.id === socket.id) && jugadorTurno.vivo;

        inputPalabra.disabled = !esMiTurno;

        if (esMiTurno) {
            inputPalabra.placeholder = "¡TU TURNO! Escribe...";
            // Evitamos robarle el focus si está escribiendo en el chat
            if (document.activeElement !== inputChat) {
                inputPalabra.focus();
            }
        } else {
            inputPalabra.placeholder = "Espera tu turno...";
        }
    } else {
        inputPalabra.disabled = true;
        if (estado.preparando) {
            inputPalabra.placeholder = "¡Prepárate!...";
        } else {
            inputPalabra.placeholder = "Esperando jugadores...";
        }
    }


    // Botón de revancha
    const jugadoresVivos = jugadores.filter(jugador => jugador.vivo).length;
    if (!estado.enJuego && !estado.preparando && nJugadores > 1 && jugadoresVivos <= 1) {
        botonRevancha.style.display = "block";
    } else {
        botonRevancha.style.display = "none";
    }
});

// Eventos del chat y logs...
socket.on("mensaje-chat", objetoMensaje => {
    const mensaje = document.createElement("div");
    mensaje.innerHTML = `<b>${objetoMensaje.usuario}:</b> ${objetoMensaje.mensaje}`;
    mensajesChat.appendChild(mensaje);
    mensajesChat.scrollTop = mensajesChat.scrollHeight;
});

socket.on("evento-log", mensaje => {
    logJuego.innerText = mensaje;
});

socket.on("error-palabra", mensaje => {
    inputPalabra.style.borderColor = "red";
    setTimeout(() => {
        inputPalabra.style.borderColor = "#3a3f4b";
    }, 500);
});

socket.on("estado-sala", objetoSala => {
    if (!infoSalaEstado) return;
    // Se formatea el .json para que se vea como vería en una terminal... 
    infoSalaEstado.textContent = JSON.stringify(objetoSala, null, 4);
});