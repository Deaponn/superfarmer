const { v4: uuidv4 } = require("uuid");

// { "roomId1": { id, name, players: [{id, nick, socketId, animals, isReady}], maxPlayers, gameStarted, gameState: {} }, ... }
let rooms = {};
const MAX_PLAYERS_PER_ROOM = 4;
const { animalSymbols, initialMainHerd } = require("./gameLogic");

function createRoom(name) {
    if (Object.values(rooms).find((r) => r.name === name)) {
        throw new Error("Room with this name already exists");
    }
    const roomId = uuidv4();
    const newRoom = {
        id: roomId,
        name,
        players: [],
        maxPlayers: MAX_PLAYERS_PER_ROOM,
        gameStarted: false,
        gameState: null,
    };
    rooms[roomId] = newRoom;
    return newRoom;
}

function joinRoom(roomId, playerId, playerNick) {
    const room = rooms[roomId];
    if (!room) throw new Error("Pokój nie znaleziony.");
    if (room.gameStarted) throw new Error("Gra już trwa.");
    if (room.players.length >= room.maxPlayers) throw new Error("Pokój jest pełny.");

    let player = room.players.find((p) => p.id === playerId);
    if (!player) {
        player = {
            id: playerId,
            nick: playerNick,
            socketId: null,
            animals: { rabbit: 0, sheep: 0, pig: 0, cow: 0, horse: 0, smallDog: 0, bigDog: 0 },
            isReady: false,
        };
        room.players.push(player);
    }
    return room;
}

function addPlayerToSocketRoom(socket, roomId, playerId, playerNick) {
    const room = rooms[roomId];
    if (!room) throw new Error(`Pokój ${roomId} nie istnieje.`);

    let player = room.players.find((p) => p.id === playerId);
    if (!player) {
        if (room.players.length >= room.maxPlayers) throw new Error("Pokój jest pełny.");
        if (room.gameStarted) throw new Error("Gra już trwa, nie można dołączyć jako nowy gracz.");
        player = {
            id: playerId,
            nick: playerNick,
            animals: { rabbit: 0, sheep: 0, pig: 0, cow: 0, horse: 0, smallDog: 0, bigDog: 0 },
            isReady: false,
        };
        room.players.push(player);
    }
    player.socketId = socket.id;
    socket.join(roomId);
    return room;
}

function removePlayerFromSocketRoom(socket, roomId, playerId) {
    const room = rooms[roomId];
    if (room) {
        const playerIndex = room.players.findIndex((p) => p.id === playerId);
        if (playerIndex !== -1) {
            const removedPlayer = room.players.splice(playerIndex, 1)[0];
            console.log(`Gracz ${removedPlayer.nick} usunięty z pokoju ${roomId}`);
            socket.leave(roomId);
            if (room.players.length === 0) {
                console.log(`Pokój ${roomId} jest pusty. Usuwanie pokoju.`);
                delete rooms[roomId];
            }
            return removedPlayer;
        }
    }
    return null;
}

function getRoom(roomId) {
    return rooms[roomId];
}
function getAllRooms() {
    return Object.values(rooms);
}
function isPlayerInRoom(roomId, playerId) {
    const room = getRoom(roomId);
    return room && room.players.some((p) => p.id === playerId);
}

function setPlayerReady(roomId, playerId) {
    const room = getRoom(roomId);
    if (!room || room.gameStarted) throw new Error("Nie można zmienić statusu gotowości.");
    const player = room.players.find((p) => p.id === playerId);
    if (!player) throw new Error("Gracz nie znaleziony w pokoju.");
    player.isReady = !player.isReady;
    console.log(
        `Gracz ${player.nick} w pokoju ${roomId} jest teraz ${
            player.isReady ? "gotowy" : "niegotowy"
        }.`
    );
    return room;
}

function addLogMessageToRoom(room, message) {
    if (room && room.gameState) {
        if (!room.gameState.log) {
            room.gameState.log = [];
        }
        const timestamp = new Date().toLocaleTimeString();
        room.gameState.log.push(`[${timestamp}] ${message}`);
        if (room.gameState.log.length > 50) {
            room.gameState.log.shift();
        }
    }
}

module.exports = {
    createRoom,
    joinRoom,
    getRoom,
    getAllRooms,
    addPlayerToSocketRoom,
    removePlayerFromSocketRoom,
    setPlayerReady,
    isPlayerInRoom,
    addLogMessageToRoom,
    animalSymbols,
    initialMainHerd,
};
