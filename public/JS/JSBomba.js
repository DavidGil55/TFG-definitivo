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
infoSalaEstado = document.getElementById("info-sala-estado"),
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

    } else {
        mensajesChat.style.display = "block";
        infoSalaEstado.style.display = "none";
        inputChat.style.display = "block"; 
        botonCambio.innerText = "Ver información de la sala";
        clearInterval(pedirInfo);
        pedirInfo = ""; 
    }
});


// Unirse a la sala
function unirseSala(sala) {
    if (!sala) return;
    const modoJuego =  localStorage.getItem("modo-juego").toLowerCase();
    const codSala = sala.toUpperCase();
    tituloSala.innerText = "SALA: " + codSala;
    const apodoJugador = prompt(`Introduce tu apodo para la sala ${codSala}:`); // Prompt molesto.
    console.log(`Uniéndose a sala: ${codSala}...`);
    // Este paquete luego será recibido por sockets.mjs en la línea ~9, y se leerá el código de la sala.
    socket.emit("unirse-sala", codSala, apodoJugador, modoJuego); 
}

unirseSala(codigoSala);

// Salirse de la sala
botonSalir.addEventListener("click", () => {
    window.location.href = "/"; 
    socket.disconnect(); 
});

// --- EVENTOS DEL JUGADOR ---

// Enviar mensaje de chat
inputChat.addEventListener("keydown", evento => {
    if (evento.key === "Enter" && inputChat.value.trim() !== "") {
        socket.emit("enviar-chat", inputChat.value);
        inputChat.value = "";
    }    
});


// Enviar palabra a la bomba
inputPalabra.addEventListener("keydown", (evento) => {
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
        botonRevancha.style.display = "none";
    });
}

// --- ACTUALIZACIONES DEL SERVIDOR ---

socket.on("estado-juego", (estado) => {
    // 1. Temporizador
    if (contadorCentral) {
        if (estado.enJuego || estado.preparando) {
            contadorCentral.innerText = estado.preparando ? "Esperando..." : estado.tiempo;
        } else {
            contadorCentral.innerText = "Esperando jugadores...";
            contadorCentral.style.fontSize = "2rem";
        }
    }

    // 2. Sílaba
    if (textoSilaba) {
        if (estado.enJuego || estado.preparando) {
            textoSilaba.innerText = estado.silaba.toUpperCase();
        } else {
            textoSilaba.innerText = "--";
        }
    }

    // 3. Dibujar círculo de jugadores
    const jugadores = estado.jugadores || [];
    const numPlayers = jugadores.length;

    if (contenedorJugadores) contenedorJugadores.innerHTML = "";

    const radius = 250; // Radio del círculo

    jugadores.forEach((jugador, index) => {
        // Matemáticas para repartir en círculo
        const anguloRad = (index / numPlayers) * (2 * Math.PI) - (Math.PI / 2);
        const x = Math.cos(anguloRad) * radius;
        const y = Math.sin(anguloRad) * radius;

        const playerCardDiv = document.createElement("div");
        playerCardDiv.className = "jugador-card";

        // Clases de CSS para turno activo y muerte
        if (estado.enJuego && index === estado.turnoActual && jugador.vivo) {
            playerCardDiv.classList.add("turno-activo");
        }
        if (!jugador.vivo) {
            playerCardDiv.classList.add("muerto");
        }

        // Posicionamiento
        playerCardDiv.style.left = `calc(50% + ${x}px)`;
        playerCardDiv.style.top = `calc(50% + ${y}px)`;
        playerCardDiv.style.transform = "translate(-50%, -50%)";

        const esMio = jugador.id === socket.id;
        const corazones = "❤️".repeat(Math.max(0, jugador.vidas)) + "🖤".repeat(Math.max(0, 2 - jugador.vidas));

        playerCardDiv.innerHTML = `
            <div class="jugador-icono">👤</div>
            <div class="jugador-info">
                <div class="jugador-nombre">${jugador.nombre} ${esMio ? "(TÚ)" : ""}</div> 
                <div class="jugador-vidas">${corazones}</div>
            </div>
        `;
        if (contenedorJugadores) contenedorJugadores.appendChild(playerCardDiv);
    });

    // 4. Gestión del Input (Habilitar/Deshabilitar teclado)
    if (inputPalabra) {
        if (estado.enJuego && !estado.preparando && numPlayers > 0) {
            const jugadorTurno = jugadores[estado.turnoActual];
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
    }

    // 5. Mostrar/Ocultar botón de Revancha
    const vivos = jugadores.filter(j => j.vivo).length;
    if (botonRevancha) {
        if (!estado.enJuego && !estado.preparando && numPlayers > 1 && vivos <= 1) {
            botonRevancha.style.display = "block";
        } else {
            botonRevancha.style.display = "none";
        }
    }
});

// Eventos del chat y logs...
socket.on("mensaje-chat", objetoMensaje => {
    if (!mensajesChat) return;
    const mensaje = document.createElement("div");
    mensaje.innerHTML = `<b>${objetoMensaje.usuario}:</b> ${objetoMensaje.mensaje}`;
    mensajesChat.appendChild(mensaje);
    mensajesChat.scrollTop = mensajesChat.scrollHeight;
});

socket.on("evento-log", mensaje => {
    if (logJuego) logJuego.innerText = mensaje;
});

socket.on("error-palabra", mensaje => {
    if (!inputPalabra) return;
    inputPalabra.style.borderColor = "red";
    setTimeout(() => {
        inputPalabra.style.borderColor = "#3a3f4b";
    }, 500);
});

socket.on("estado-sala", (objetoSala) => {
    if (infoSalaEstado) {
        // Formateamos el objeto con 4 espacios para que se vea como en la terminal
        infoSalaEstado.textContent = JSON.stringify(objetoSala, null, 4);
    }
});