const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const {
    createRoom,
    joinRoom,
    getRoom,
    getAllRooms,
    addPlayerToSocketRoom,
    removePlayerFromSocketRoom,
    setPlayerReady,
    isPlayerInRoom,
} = require("./roomManager");
const {
    initializeGame,
    handleRollDice,
    handleExchangeWithBank,
    checkWinCondition,
    determineNextPlayer,
} = require("./gameLogic");
const { addPlayer, getPlayer } = require("./playerManager");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, "client")));

const socketPlayerMap = {};

app.post("/api/player", (req, res) => {
    const { nick } = req.body;
    if (!nick) return res.status(400).json({ message: "Nickname required" });
    const playerId = addPlayer(nick);
    res.json({ success: true, playerId });
});

app.get("/api/rooms", (req, res) => {
    res.json(
        getAllRooms().map(({ id, name, players, maxPlayers, gameStarted }) => ({
            id,
            name,
            playerCount: players.length,
            maxPlayers,
            gameStarted,
        }))
    );
});

app.post("/api/rooms", (req, res) => {
    const { name } = req.body;
    if (!name) {
        return res
            .status(400)
            .json({ message: "Room name is required" });
    }
    try {
        const newRoom = createRoom(name);
        res.status(201).json(newRoom);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

app.post("/api/rooms/:roomId/join", (req, res) => {
    const { roomId } = req.params;
    const { playerId } = req.body;
    const { nick } = getPlayer(playerId);
    if (!playerId || !nick) {
        return res.status(400).json({ message: "PlayerId is mandatory" });
    }
    try {
        const room = joinRoom(roomId, playerId, nick);
        res.json({ success: true, roomDetails: room });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// --- WebSocket Connection Handling ---
io.on("connection", (socket) => {
    socket.on("joinRoom", ({ roomId, playerId }) => {
        if (!roomId || !playerId) {
            socket.emit("error", {
                message: "Brakujące dane do dołączenia do pokoju (roomId, playerId).",
            });
            return;
        }
        const { nick: playerNick } = getPlayer(playerId);
        try {
            const room = getRoom(roomId);
            if (!room) {
                socket.emit("error", { message: `Pokój ${roomId} nie istnieje.` });
                return;
            }
            if (!isPlayerInRoom(roomId, playerId) && room.players.length >= room.maxPlayers) {
                socket.emit("error", { message: "Pokój jest pełny." });
                return;
            }
            if (room.gameStarted && !isPlayerInRoom(roomId, playerId)) {
                socket.emit("error", { message: "Gra w tym pokoju już się rozpoczęła." });
                return;
            }

            addPlayerToSocketRoom(socket, roomId, playerId, playerNick);
            socketPlayerMap[socket.id] = { playerId, roomId };

            io.to(roomId).emit("roomUpdate", room);
            socket.emit("joinedRoom", room);
            console.log(
                `Gracz ${playerNick} (ID: ${playerId}, Socket: ${socket.id}) dołączył do pokoju ${roomId} przez WebSocket.`
            );
        } catch (error) {
            socket.emit("error", { message: error.message });
        }
    });

    socket.on("playerReady", () => {
        const playerData = socketPlayerMap[socket.id];
        if (!playerData) return;
        const { playerId, roomId } = playerData;

        try {
            const room = setPlayerReady(roomId, playerId);
            io.to(roomId).emit("roomUpdate", room);

            const readyPlayers = room.players.filter((p) => p.isReady).length;
            if (
                room.players.length >= 2 &&
                readyPlayers === room.players.length &&
                !room.gameStarted
            ) {
                initializeGame(room);
                io.to(roomId).emit("gameStarting", room); // Wysyła cały obiekt pokoju ze stanem gry
                io.to(roomId).emit("turnChange", {
                    nextPlayerId: room.gameState.currentPlayerId,
                    nextPlayerNick: room.players.find(
                        (p) => p.id === room.gameState.currentPlayerId
                    )?.nick,
                    roomDetails: room,
                });
            }
        } catch (error) {
            socket.emit("error", { message: error.message });
        }
    });

    socket.on("rollDice", () => {
        const playerData = socketPlayerMap[socket.id];
        if (!playerData) return;
        const { playerId, roomId } = playerData;
        const room = getRoom(roomId);

        if (!room || !room.gameStarted || room.gameState.currentPlayerId !== playerId) {
            socket.emit("error", {
                message: "Nie można rzucić kością: nie twoja tura lub gra nie wystartowała.",
            });
            return;
        }

        const result = handleRollDice(room, playerId); // Modyfikuje `room`
        io.to(roomId).emit("diceRollResult", {
            playerId,
            nick: room.players.find((p) => p.id === playerId)?.nick,
            diceResult: result.diceResult,
            log: result.logMessages,
            updatedRoom: room, // Wysyłamy cały zaktualizowany pokój
        });

        if (checkWinCondition(room.players.find((p) => p.id === playerId))) {
            io.to(roomId).emit("gameOver", {
                winnerId: playerId,
                winnerNick: room.players.find((p) => p.id === playerId)?.nick,
                roomDetails: room,
            });
            // Opcjonalnie: room.gameStarted = false;
        } else {
            room.gameState.currentPlayerId = determineNextPlayer(room, playerId);
            const nextPlayer = room.players.find((p) => p.id === room.gameState.currentPlayerId);
            io.to(roomId).emit("turnChange", {
                nextPlayerId: room.gameState.currentPlayerId,
                nextPlayerNick: nextPlayer?.nick,
                roomDetails: room,
            });
        }
    });

    socket.on("exchangeWithBank", ({ exchange }) => {
        // exchange: { fromAnimal, fromAmount, toAnimal }
        const playerData = socketPlayerMap[socket.id];
        if (!playerData) return;
        const { playerId, roomId } = playerData;
        const room = getRoom(roomId);

        if (!room || !room.gameStarted || room.gameState.currentPlayerId !== playerId) {
            socket.emit("error", {
                message: "Nie można wymienić: nie twoja tura lub gra nie wystartowała.",
            });
            return;
        }
        // TODO: Dodaj flagę, czy gracz już wymieniał w tej turze

        try {
            const result = handleExchangeWithBank(
                room,
                playerId,
                exchange.fromAnimal,
                parseInt(exchange.fromAmount),
                exchange.toAnimal
            );
            if (result.success) {
                io.to(roomId).emit("bankExchangeResult", {
                    playerId,
                    nick: room.players.find((p) => p.id === playerId)?.nick,
                    success: true,
                    log: result.log,
                    updatedRoom: room,
                });
                // Gracz pozostaje aktywny w swojej turze
                io.to(roomId).emit("turnChange", {
                    nextPlayerId: room.gameState.currentPlayerId, // Nadal ten sam gracz
                    nextPlayerNick: room.players.find(
                        (p) => p.id === room.gameState.currentPlayerId
                    )?.nick,
                    roomDetails: room,
                });
            } else {
                socket.emit("error", { message: result.log || "Wymiana z bankiem nieudana." });
            }
        } catch (error) {
            socket.emit("error", { message: error.message });
        }
    });

    // TODO: Implement `proposeTradeWithPlayer`, `acceptTradeWithPlayer`, `rejectTradeWithPlayer`

    socket.on("disconnect", () => {
        console.log("Klient rozłączony:", socket.id);
        const playerData = socketPlayerMap[socket.id];
        if (playerData) {
            const { playerId, roomId } = playerData;
            try {
                const room = getRoom(roomId);
                if (room) {
                    const wasCurrentPlayer =
                        room.gameStarted && room.gameState.currentPlayerId === playerId;
                    removePlayerFromSocketRoom(socket, roomId, playerId); // Zaktualizuje też listę graczy
                    io.to(roomId).emit("playerLeft", {
                        playerId,
                        nick: "Gracz (rozłączony)",
                        roomDetails: room,
                    }); // Przekaż zaktualizowany pokój
                    io.to(roomId).emit("roomUpdate", room);

                    if (wasCurrentPlayer && room.gameStarted && room.players.length > 0) {
                        room.gameState.currentPlayerId = determineNextPlayer(room, playerId, true); // true = znajdź następnego aktywnego
                        const nextPlayer = room.players.find(
                            (p) => p.id === room.gameState.currentPlayerId
                        );
                        if (nextPlayer) {
                            io.to(roomId).emit("turnChange", {
                                nextPlayerId: room.gameState.currentPlayerId,
                                nextPlayerNick: nextPlayer.nick,
                                roomDetails: room,
                            });
                        } else if (room.players.length === 0) {
                            // Opcjonalnie usuń pokój jeśli jest pusty
                            // deleteRoom(roomId);
                        }
                    } else if (room.gameStarted && room.players.length < 2) {
                        // Zakończ grę jeśli zostało mniej niż 2 graczy
                        // io.to(roomId).emit('gameEndedNotEnoughPlayers', { roomDetails: room });
                        // room.gameStarted = false;
                    }
                }
            } catch (error) {
                console.error("Błąd podczas rozłączania gracza:", error.message);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Serwer działa na porcie ${PORT}`));
