import { generarDosLetras } from "./diccionario.mjs";

// Variables de estado globales exportadas
export const estadosSalas = {};
export const infoPublicaSalas = {}; // El escaparate para ver las salas públicas que hay disponibles.

export function enviarEstadoLimpio(io, sala) {
    const informacionSala = estadosSalas[sala];
    if (!informacionSala) return;

    const estadoSeguro = {
        silaba: informacionSala.silaba,
        jugadores: informacionSala.jugadores,
        turnoActual: informacionSala.turnoActual,
        tiempo: informacionSala.tiempo,
        enJuego: informacionSala.enJuego,
        preparando: informacionSala.preparando
    };
    io.to(sala).emit("estado-juego", estadoSeguro);
};

export function iniciarPartida(io, sala) {
    const informacionSala = estadosSalas[sala];
    if (!informacionSala) return;

    informacionSala.enJuego = false;
    informacionSala.preparando = true;
    io.to(sala).emit("evento-log", "¡Preparados...");

    let cuenta = 3;
    informacionSala.silaba = cuenta.toString();
    enviarEstadoLimpio(io, sala);

    const cuentaInterval = setInterval(() => {
        cuenta--;
        if (cuenta > 0) {
            informacionSala.silaba = cuenta.toString();
            enviarEstadoLimpio(io, sala);
        } else {
            clearInterval(cuentaInterval);
            if (!estadosSalas[sala]) return;
            
            informacionSala.preparando = false;
            informacionSala.enJuego = true;
            informacionSala.tiempo = 10;
            informacionSala.silaba = generarDosLetras();
            informacionSala.turnoActual = informacionSala.jugadores.findIndex(j => j.vivo);
            if(informacionSala.turnoActual === -1) informacionSala.turnoActual = 0;

            io.to(sala).emit("evento-log", "¡A JUGAR!");
            
            informacionSala.intervalo = setInterval(() => {
                informacionSala.tiempo--;
                if (informacionSala.tiempo <= 0) {
                    const jugadorActual = informacionSala.jugadores[informacionSala.turnoActual];
                    jugadorActual.vidas--;
                    io.to(sala).emit("evento-log", ` ¡BOOM! ${jugadorActual.nombre} pierde una vida.`);

                    if (jugadorActual.vidas <= 0) {
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

export function siguienteTurno(io, sala) {
    const informacionSala = estadosSalas[sala];
    if (!informacionSala) return;

    const vivos = informacionSala.jugadores.filter(j => j.vivo);
    if (vivos.length <= 1 && informacionSala.jugadores.length > 1) {
        clearInterval(informacionSala.intervalo);
        informacionSala.enJuego = false;
        const ganador = vivos.length === 1 ? vivos[0].nombre : "Nadie";
        io.to(sala).emit("evento-log", ` ¡${ganador} HA GANADO LA PARTIDA!`);
        enviarEstadoLimpio(io, sala); 
        return;
    }

    do {
        informacionSala.turnoActual = (informacionSala.turnoActual + 1) % informacionSala.jugadores.length;
    } while (!informacionSala.jugadores[informacionSala.turnoActual].vivo && vivos.length > 1);

    informacionSala.tiempo = 10;
    informacionSala.silaba = generarDosLetras();
    enviarEstadoLimpio(io, sala); 
};


export const penalizarTiempo = (io, sala) => {
    const informacionSala = estadosSalas[sala];
    if (!informacionSala || !informacionSala.enJuego) return;

    informacionSala.tiempo--;
    if (informacionSala.tiempo < 0) informacionSala.tiempo = 0; // Para que no salgan números negativos

    // Enviamos el estado inmediatamente para que los jugadores vean el salto en el temporizador
    enviarEstadoLimpio(io, sala);
};