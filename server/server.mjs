import http from "node:http";
import path from "node:path";
import os from "node:os";
import express from "express";
import { Server } from "socket.io";
import { configurarSockets } from "./sockets.mjs";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Rutas
app.use(express.static("../public")); // Ruta estática.
app.get("/", (req, res) => {
    res.sendFile(path.resolve("../public", "HTML", "index.html"));
});
app.get("/bomba", (req, res) => {
    res.sendFile(path.resolve("../public", "HTML", "bomba.html"));
});
app.get("/bomba/:IDSala", (req, res) => {
    // Pasa el ID que ha escrito el usuario en la URL (o lo ha generado dándole al botón de "Crear sala"), lo pasa a mayúscula y lo guarda en "sala".
    const sala = req.params.IDSala.toUpperCase();
    // Se comprueba si el ID es correcto, y si sí lo es, se carga la página de la bomba.
    if (/^[A-Z]{4}$/.test(sala)) res.sendFile(path.resolve("../public", "HTML", "bomba.html"));
    // Sino, te manda al lobby.
    else res.redirect("/");
});

// Arrancar los sockets importados
configurarSockets(io);

// Lanzamiento
server.listen(3000, "0.0.0.0", () => {
    // Se guarda la ipLocal en una variable vacía para utilzarlo luego...
    let ipLocal = "";
    const interfaces = os.networkInterfaces(); // Se cargan TODAS las interfaces de red.
    for (var interfaz in interfaces) { // Por cada interfaz de red saca su interfaz...
        for (var direccionIP of interfaces[interfaz]) { // Luego, por cada interfaz, sácale la IP.
            // Ahora se busca una IP que no sea IPv6 y tampoco interna.
            if (direccionIP.family !== "IPv6" && !direccionIP.internal) {
                ipLocal = direccionIP.address; // La IP que se saque será la IP del servidor.
            }
        }
    }
    console.log("\n**********************************************");
    console.log("SERVIDOR LISTO");
    console.log(`IP para conectarse: http://${ipLocal}:3000`);
    console.log("**********************************************\n");
});