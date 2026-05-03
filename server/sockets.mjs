import { diccionario } from "./diccionario.mjs";
import { objetoSalas, infoPublicaSalas, enviarInfoPublicaJugadores, iniciarPartida, siguienteTurno, penalizarTiempo } from "./motorBomba.mjs";

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
            if (!objetoSalas[codigoSala]) {
                objetoSalas[codigoSala] = {
                    silaba: "",
                    palabrasUsadas: [],
                    jugadores: [],
                    votosRevancha: [],
                    indiceTurno: 0,
                    tiempo: 10,
                    enJuego: false,
                    preparando: false, 
                    intervalo: null,
                    modoJuego: modo
                };
            }

            const info = objetoSalas[codigoSala]; // Información de una sala específica [ XXXX ]. 

            info.jugadores.push({ // Aquí se agrega al jugador a la sala...
                id: socket.id, 
                nombre: socket.nombreUsuario, 
                vidas: 2, 
                vivo: true 
            });

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
            enviarInfoPublicaJugadores(io, codigoSala);
        });

        // Hacer la revancha que le den almenos dos jugadores de la sala para que ocurra...
        socket.on("pedir-revancha", () => {
            const sala = socket.salaActual;
            const info = objetoSalas[sala];

            if (!info.enJuego && !info.preparando) {
                if (!info.votosRevancha.includes(socket.id)) {
                    // Se agrega el ID del jugador que vota por la revancha.
                    info.votosRevancha.push(socket.id);
                    const votosActuales = info.votosRevancha.length;
                    // Math.ceil calcula la mitad de los jugadores hacia arriba, y el Math.max hace que como mínimo se necesiten 2 votos para la revancha...
                    const votosNecesarios = Math.max(2, Math.ceil(info.jugadores.length / 2));

                    io.to(sala).emit("mensaje-chat", { 
                        usuario: "<span id=\"spanSistema\">SISTEMA</span>", 
                        mensaje: `${socket.nombreUsuario} quiere revancha! (${votosActuales}/${votosNecesarios})` 
                    });
                    
                    // Si se llega a los votos necesarios:
                    if (votosActuales >= votosNecesarios) {
                        io.to(sala).emit("mensaje-chat", { 
                            usuario: "<span id=\"spanSistema\">SISTEMA</span>", 
                            mensaje: `Se hace revancha! Reiniciando la bomba...` 
                        });
                        
                        // Se reinicia la sala para la revancha...
                        info.votosRevancha = []; 
                        info.jugadores.forEach(jugador => { jugador.vidas = 2; jugador.vivo = true; });
                        info.palabrasUsadas = [];
                        iniciarPartida(io, sala);
                    }
                }
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
            if (objetoSalas[sala]) {
                // Los "..." crean una copia del objeto y se la guarda en copiaInfo, pero el objeto original sigue intacto.
                const copiaInfo = { ...objetoSalas[sala] };
                // No se le puede pasar el setInterval() completo porque es un objeto en sí muy grande...
                copiaInfo.intervalo = copiaInfo.intervalo ? "Está en marcha..." : "Detenido";
                socket.emit("estado-sala", copiaInfo);
            }
        });

        socket.on("enviar-palabra", palabraSucia => {
            const sala = socket.salaActual;
            const info = objetoSalas[sala];

            // Si no hay sala, no envíes la palabra a la bomba.
            if (!info) return;

            const turnoJugador = info.jugadores[info.indiceTurno];
            if (turnoJugador.id !== socket.id) return socket.emit("error-palabra", "Que no es tu turno!");

            const palabraLimpia = palabraSucia.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

            // Si la palabra ya se usó...
            if (info.palabrasUsadas.includes(palabraLimpia)) {
                penalizarTiempo(io, sala); 
                return socket.emit("error-palabra", "Esa palabra ya se usó.");
            }

            // Si la palabra es correcta...
            if (palabraLimpia.includes(info.silaba.toLowerCase()) && diccionario.has(palabraLimpia)) {
                info.palabrasUsadas.push(palabraLimpia);
                io.to(sala).emit("evento-log", `La palabra es correcta ${socket.nombreUsuario}: ${palabraLimpia}!`);
                siguienteTurno(io, sala); 
                return;
            }
            // Si la palabra es incorrecta o se la ha inventado...
                penalizarTiempo(io, sala); 
                socket.emit("error-palabra", "La palabra no es válida!");
        });

        socket.on("disconnect", () => {
            const sala = socket.salaActual;
            const info = objetoSalas[sala];

            // Este if es por si el jugador se quedó en la pantalla del prompt y se desconectó.
            if (info) {
                const jugadorDesconectado = info.jugadores.find(jugador => jugador.id === socket.id);
                if (jugadorDesconectado) {
                    io.to(sala).emit("mensaje-chat", { 
                        usuario: "<span id=\"spanSistema\">SISTEMA</span>", 
                        mensaje: `${jugadorDesconectado.nombre} salió.` 
                    });
                }
                info.jugadores = info.jugadores.filter(jugador => jugador.id !== socket.id);

                // Si no existe la sala de borra del todo
                if (info.jugadores.length === 0) {
                    clearInterval(info.intervalo); 
                    delete objetoSalas[sala];
                    delete infoPublicaSalas[sala];
                } else {
                    // Si no se actualiza la lista de jugadores...
                    infoPublicaSalas[sala].jugadores = info.jugadores.length;

                    const jugadoresVivos = info.jugadores.filter(jugador => jugador.vivo).length;
                    if (info.enJuego && jugadoresVivos <= 1) {
                        siguienteTurno(io, sala);
                        // Si se desconecta el jugador al que le tocaba, se le pasa el turno al siguiente jugador vivo.
                    } else if (info.indiceTurno >= info.jugadores.length) {
                        info.indiceTurno = 0;
                    }

                    enviarInfoPublicaJugadores(io, sala);
                    io.to(sala).emit("evento-log", `${socket.nombreUsuario} se desconectó...`);
                }
                io.emit("lista-salas-actualizada", Object.values(infoPublicaSalas));
            }
        });
    });
};