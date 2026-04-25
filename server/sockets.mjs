import { diccionario } from "./diccionario.mjs";
import { estadosSalas, infoPublicaSalas, enviarEstadoLimpio, iniciarPartida, siguienteTurno, penalizarTiempo } from "./motorBomba.mjs";

// Utilizar - para separar palabras.
export function configurarSockets(io) {
    io.on("connection", socket => { // No se puede cambiar el "connection"...
        socket.emit("lista-salas-actualizada", Object.values(infoPublicaSalas));

        socket.on("unirse-sala", (sala, nombre, modo) => {
            const codigoSala = sala.toUpperCase(); // Código [ XXXX ] de la sala.

            socket.join(codigoSala);
            socket.salaActual = codigoSala;
            socket.nombreUsuario = nombre || "Jugador_" + socket.id.substring(0, 3); // Si el jugador no se pone nombre, se le asigna uno genérico.

            // Si aún no existe la sala, se crea una con su estado inicial.
            if (!estadosSalas[codigoSala]) {
                estadosSalas[codigoSala] = {
                    silaba: "",
                    palabrasUsadas: [],
                    jugadores: [],
                    turnoActual: 0,
                    tiempo: 10,
                    enJuego: false,
                    preparando: false, 
                    intervalo: null,
                    modoJuego: modo
                };
            }

            const info = estadosSalas[codigoSala]; // Información de una sala específica [ XXXX ]. 

            info.jugadores.push({ // Aquí se agrega al jugador a la sala, con su ID del socket, nombre, vidas y estado de vivo.
                id: socket.id, 
                nombre: socket.nombreUsuario, 
                vidas: 2, 
                vivo: true 
            });
            
            console.log(`\n--- ESTADO ACTUAL DE LA SALA: ${codigoSala} ---`);
            console.dir(info, { depth: null }); // Usamos console.dir para ver todo el objeto sin que salga [Object]
            console.log("-----------------------------------\n");

            if (!infoPublicaSalas[codigoSala]) {
                infoPublicaSalas[codigoSala] = { 
                    codigo: codigoSala, 
                    creador: socket.nombreUsuario, 
                    jugadores: info.jugadores.length,
                    modoJuego: info.modoJuego 
                };
            } else {
                infoPublicaSalas[codigoSala].jugadores = info.jugadores.length;
            }

            io.emit("lista-salas-actualizada", Object.values(infoPublicaSalas));
            io.to(codigoSala).emit("mensaje-chat", { usuario: "<span id=\"spanSistema\">SISTEMA</span>", mensaje: `${socket.nombreUsuario} se unió.` });

            if (info.jugadores.length >= 2 && !info.enJuego && !info.preparando) {
                // El return sirve para terminar la ejecuión de la función.
                return iniciarPartida(io, codigoSala);
            } 
            enviarEstadoLimpio(io, codigoSala);
        });

        // Hacer la revancha que le den almenos dos jugadores de la sala para que ocurra...
        socket.on("pedir-revancha", () => {
            const sala = socket.salaActual;
            const info = estadosSalas[sala];

            if (info && !info.enJuego && !info.preparando) {
                io.to(sala).emit("mensaje-chat", { usuario: "<span id=\"spanSistema\">SISTEMA</span>", mensaje: `¡${socket.nombreUsuario} quiere revancha! Reiniciando...` });
                info.jugadores.forEach(jugador => { jugador.vidas = 2; jugador.vivo = true; });
                info.palabrasUsadas = [];
                iniciarPartida(io, sala);
            }
        });

        socket.on("enviar-chat", mensaje => {
            // Si no estás en una sala no puedes enviar mensajes. 
            if (!socket.salaActual) return;
            io.to(socket.salaActual).emit("mensaje-chat", { 
                    usuario: socket.nombreUsuario, 
                    mensaje: mensaje 
                });
        });

        socket.on("pedir-info-sala", () => {
            // socket.salaActual = la sala actual en la que está el jugador...
            const sala = socket.salaActual;
            if (sala && estadosSalas[sala]) {
                // Los ... crean una copia del objeto y se la guarda en infoSegura, pero el objeto original sigue intacto...
                const infoSegura = { ...estadosSalas[sala] };
                infoSegura.intervalo = infoSegura.intervalo ? "En marcha..." : "Detenido.";
                socket.emit("estado-sala", infoSegura);
            }
        });

        socket.on("enviar-palabra", (palabraRaw) => {
            const sala = socket.salaActual;
            const info = estadosSalas[sala];

            // Si no hay sala, o no están jugando o están en estado de preparación, no envíes la palabra a la bomba.
            if (!info || !info.enJuego || info.preparando) return;

            const jugadorTurno = info.jugadores[info.turnoActual];
            if (jugadorTurno.id !== socket.id) return socket.emit("error-palabra", "No es tu turno");

            const p = palabraRaw.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

            // SI LA PALABRA YA SE USÓ:
            if (info.palabrasUsadas.includes(p)) {
                penalizarTiempo(io, sala); // <-- RESTA 1 SEGUNDO
                return socket.emit("error-palabra", "¡Esa palabra ya se usó!");
            }

            // SI LA PALABRA ES CORRECTA:
            if (p.includes(info.silaba.toLowerCase()) && diccionario.has(p)) {
                info.palabrasUsadas.push(p);
                io.to(sala).emit("evento-log", `Palabra correcta ${socket.nombreUsuario}: ${p}`);
                siguienteTurno(io, sala); 
            } else {
            // SI LA PALABRA ES INCORRECTA O INVENTADA:
                penalizarTiempo(io, sala); // <-- RESTA 1 SEGUNDO
                socket.emit("error-palabra", "Palabra no válida");
            }
        });

        socket.on("disconnect", () => {
            const sala = socket.salaActual;
            const info = estadosSalas[sala];

            if (info) {
                const jugadorDesconectado = info.jugadores.find(jugador => jugador.id === socket.id);
                if (jugadorDesconectado) {
                    io.to(sala).emit("mensaje-chat", { 
                        usuario: "<span id=\"spanSistema\">SISTEMA</span>", 
                        mensaje: `${jugadorDesconectado.nombre} salió.` 
                    });
                }
                info.jugadores = info.jugadores.filter(jugador => jugador.id !== socket.id);

                if (info.jugadores.length === 0) {
                    clearInterval(info.intervalo); 
                    delete estadosSalas[sala];
                    delete infoPublicaSalas[sala];
                } else {
                    if (infoPublicaSalas[sala]) infoPublicaSalas[sala].jugadores = info.jugadores.length;

                    const jugadoresVivosRestantes = info.jugadores.filter(jugador => jugador.vivo).length;
                    if (info.enJuego && jugadoresVivosRestantes <= 1) {
                        siguienteTurno(io, sala);
                    } else if (info.turnoActual >= info.jugadores.length) {
                        info.turnoActual = 0;
                    }

                    enviarEstadoLimpio(io, sala);
                    io.to(sala).emit("evento-log", `${socket.nombreUsuario} se desconectó...`);
                }
                io.emit("lista-salas-actualizada", Object.values(infoPublicaSalas));
            }
        });
    });
};