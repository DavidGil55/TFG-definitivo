import { generarDosLetras } from "./diccionario.mjs";

// Variable con todas las salas...
export const objetoSalas = {};
// El escaparate para ver las salas públicas que hay disponibles
export const infoPublicaSalas = {}; 

export const enviarEstadoLimpio = (io, sala) => {
    // Si no hay sala lo termina todo...
    if (!sala) return;
    const info = objetoSalas[sala];
    // Esto es lo que recibe el front-end.
    const estadoSeguro = {
        silaba: info.silaba,
        jugadores: info.jugadores,
        indiceTurno: info.indiceTurno,
        tiempo: info.tiempo,
        enJuego: info.enJuego,
        preparando: info.preparando
    };
    io.to(sala).emit("estado-juego", estadoSeguro);
};

export const iniciarPartida = (io, sala) => {
    const info = objetoSalas[sala];
    if (!info) return;

    info.enJuego = false;
    info.preparando = true;
    io.to(sala).emit("evento-log", "¡Preparados...");

    let cuentraAtras = 5;
    // Esto hace que se muestre la cuenta atrás dentro de la bomba.
    info.silaba = cuentraAtras.toString();
    enviarEstadoLimpio(io, sala);

    const cuentaIntervalo = setInterval(() => {
        cuentraAtras--;
        if (cuentraAtras > 0) {
            info.silaba = cuentraAtras.toString();
            enviarEstadoLimpio(io, sala);
        } else {
            clearInterval(cuentaIntervalo);
            if (!objetoSalas[sala]) return;
            
            if (info.jugadores.length <= 1) {
                detenerPartida(io, sala, "Partida detenida. Faltan jugadores...");
                return; 
            }           

            info.preparando = false;
            info.enJuego = true;
            info.tiempo = 10;
            info.silaba = generarDosLetras();
            info.indiceTurno = info.jugadores.findIndex(j => j.vivo);
            if(info.indiceTurno === -1) info.indiceTurno = 0;

            io.to(sala).emit("evento-log", "¡A JUGAR!");
            
            info.intervalo = setInterval(() => {
                info.tiempo--;
                if (info.tiempo <= 0) {
                    const jugadorActual = info.jugadores[info.indiceTurno];
                    jugadorActual.vidas--;
                    io.to(sala).emit("evento-log", ` ¡BOOM! ${jugadorActual.nombre} pierde una vida.`);

                    if (jugadorActual.vidas === 0) {
                        jugadorActual.vivo = false;
                        io.to(sala).emit("evento-log", ` ${jugadorActual.nombre} ha sido eliminado.`);
                    }
                    siguienteTurno(io, sala);
                } else {
                    enviarEstadoLimpio(io, sala);
                }
            }, 1000);
            enviarEstadoLimpio(io, sala);
        }
    }, 1000);
};

export const siguienteTurno = (io, sala) => {
    const info = objetoSalas[sala];
    if (!info) return;

    // Si solo hay una persona en la sala se detiene la partida
    if (info.jugadores.length <= 1) {
        detenerPartida(io, sala, "Partida detenida. Faltan jugadores...");
        return; 
    }

    const jugadoresVivos = info.jugadores.filter(jugador => jugador.vivo);

    if (jugadoresVivos.length === 1 && info.jugadores.length > 1) {
        clearInterval(info.intervalo);
        info.enJuego = false;
        const ganador = jugadoresVivos[0].nombre;
        io.to(sala).emit("evento-log", `${ganador} HA GANADO LA PARTIDA!`);
        enviarEstadoLimpio(io, sala); 
        return;
    }

    // Aquí se calcula el indiceTurno, el cual sigue al jugador que le toca.
    do {
        info.indiceTurno = (info.indiceTurno + 1) % info.jugadores.length;
    } while (!info.jugadores[info.indiceTurno].vivo && jugadoresVivos.length > 1);

    // Se reinicia la sala...
    info.tiempo = 10;
    info.silaba = generarDosLetras();
    enviarEstadoLimpio(io, sala); 
};

export const penalizarTiempo = (io, sala) => {
    const info = objetoSalas[sala];
    if (!info) return;
    info.tiempo--;
    if (info.tiempo < 0) info.tiempo = 0; // Para que no salgan números negativos
    // Se envía el estado para que los jugadores vean el salto en el temporizador
    enviarEstadoLimpio(io, sala);
};

const detenerPartida = (io, sala, mensajeAviso = "") => {
    const info = objetoSalas[sala];
    if (!info) return;

    // Se ponen todos los valores por defecto...
    clearInterval(info.intervalo); 
    info.intervalo = null;
    info.enJuego = false;
    info.preparando = false;
    info.tiempo = 10;
    info.silaba = "";
    info.palabrasUsadas = [];
    info.indiceTurno = 0;

    // Se vuelve al único jugador que hay a su estado por defecto...
    info.jugadores[0].vidas = 2;
    info.jugadores[0].vivo = true;

    // Se envía la información al log y el estado.
    io.to(sala).emit("evento-log", mensajeAviso);
    enviarEstadoLimpio(io, sala);
};