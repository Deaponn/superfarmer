// Prosta implementacja w pamięci
let rooms = {}; // { "roomId1": { id, name, players: [{id, nick, socketId, animals, isReady}], maxPlayers, gameStarted, gameState: {} }, ... }
const MAX_PLAYERS_PER_ROOM = 4;
const { animalSymbols, initialMainHerd } = require('./gameLogic'); // Import z gameLogic lub utils

function generateId(prefix = "id_") {
    return `${prefix}${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function createRoom(name, creatorPlayerId, creatorPlayerNick) {
    if (Object.values(rooms).find(r => r.name === name)) {
        throw new Error("Pokój o tej nazwie już istnieje.");
    }
    const roomId = generateId("room_");
    const newRoom = {
        id: roomId,
        name: name || `Pokój ${roomId.substring(5, 9)}`,
        players: [],
        maxPlayers: MAX_PLAYERS_PER_ROOM,
        gameStarted: false,
        gameState: null,
        hostId: creatorPlayerId
    };
    // Twórca nie jest automatycznie dodawany tutaj, dołączy przez API/Socket
    rooms[roomId] = newRoom;
    console.log(`Pokój stworzony: ${newRoom.name} (ID: ${newRoom.id}) przez ${creatorPlayerNick}`);
    return newRoom;
}

function joinRoomAPI(roomId, playerId, playerNick) {
    const room = rooms[roomId];
    if (!room) throw new Error("Pokój nie znaleziony.");
    if (room.gameStarted && !room.players.find(p => p.id === playerId)) throw new Error("Gra już trwa.");
    if (room.players.length >= room.maxPlayers && !room.players.find(p => p.id === playerId)) throw new Error("Pokój jest pełny.");

    let player = room.players.find(p => p.id === playerId);
    if (!player) {
        player = {
            id: playerId,
            nick: playerNick,
            socketId: null, // zostanie ustawiony po połączeniu WebSocket
            animals: { rabbit: 0, sheep: 0, pig: 0, cow: 0, horse: 0, smallDog: 0, bigDog: 0 },
            isReady: false
        };
        room.players.push(player);
    } else {
        player.nick = playerNick; // Aktualizuj nick, jeśli gracz ponownie dołącza
    }
    console.log(`Gracz ${playerNick} (ID: ${playerId}) dołączył do pokoju ${room.name} przez API.`);
    return room;
}

function addPlayerToSocketRoom(socket, roomId, playerId, playerNick) {
    const room = rooms[roomId];
    if (!room) throw new Error(`Pokój ${roomId} nie istnieje.`);

    let player = room.players.find(p => p.id === playerId);
    if (!player) { // Jeśli nie dołączył przez API wcześniej, lub to nowy gracz
        if (room.players.length >= room.maxPlayers) throw new Error("Pokój jest pełny.");
        if (room.gameStarted) throw new Error("Gra już trwa, nie można dołączyć jako nowy gracz.");
        player = {
            id: playerId,
            nick: playerNick,
            animals: { rabbit: 0, sheep: 0, pig: 0, cow: 0, horse: 0, smallDog: 0, bigDog: 0 },
            isReady: false
        };
        room.players.push(player);
    }
    player.socketId = socket.id; // Powiąż/zaktualizuj socketId
    socket.join(roomId); // Dołącz socket do pokoju Socket.IO
    return room;
}

function removePlayerFromSocketRoom(socket, roomId, playerId) {
    const room = rooms[roomId];
    if (room) {
        const playerIndex = room.players.findIndex(p => p.id === playerId);
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

function getRoom(roomId) { return rooms[roomId]; }
function getAllRooms() { return Object.values(rooms); }
function isPlayerInRoom(roomId, playerId) {
    const room = getRoom(roomId);
    return room && room.players.some(p => p.id === playerId);
}


function setPlayerReady(roomId, playerId) {
    const room = getRoom(roomId);
    if (!room || room.gameStarted) throw new Error("Nie można zmienić statusu gotowości.");
    const player = room.players.find(p => p.id === playerId);
    if (!player) throw new Error("Gracz nie znaleziony w pokoju.");
    player.isReady = !player.isReady;
    console.log(`Gracz ${player.nick} w pokoju ${roomId} jest teraz ${player.isReady ? 'gotowy' : 'niegotowy'}.`);
    return room;
}


module.exports = {
    createRoom, joinRoomAPI, getRoom, getAllRooms, addPlayerToSocketRoom, removePlayerFromSocketRoom,
    setPlayerReady, isPlayerInRoom,
    animalSymbols, initialMainHerd // Eksport, aby inne moduły miały dostęp
};