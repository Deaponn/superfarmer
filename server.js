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
    addLogMessageToRoom,
} = require("./roomManager");
const {
    initializeGame,
    handleRollDice,
    generateTradeId,
    playerHasAnimals,
    transferAnimals,
    handleExchangeWithBank,
    checkWinCondition,
    determineNextPlayer,
} = require("./gameLogic");
const { addPlayer, getPlayer } = require("./playerManager");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const socketPlayerMap = {};

app.post("/api/player", (req, res) => {
    const { nick } = req.body;
    if (!nick) return res.status(400).json({ message: "Nickname required" });
    console.log("adding player with nick", nick);
    const playerId = addPlayer(nick);
    console.log("new player id is", playerId);
    console.log("getting this exact player", getPlayer(playerId));
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
        return res.status(400).json({ message: "Room name is required" });
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
    console.log(`roomid ${roomId} playerid ${playerId} player`, getPlayer(playerId));
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

    socket.on("proposeTradeToPlayer", ({ targetPlayerId, offeredItems, requestedItems }) => {
        const playerData = socketPlayerMap[socket.id];
        if (!playerData) return socket.emit("error", { message: "Błąd identyfikacji gracza." });
        const { playerId: proposingPlayerId, roomId } = playerData;
        const room = getRoom(roomId);

        if (!room || !room.gameStarted) {
            return socket.emit("error", { message: "Gra nieaktywna lub pokój nie istnieje." });
        }
        if (room.gameState.currentPlayerId !== proposingPlayerId) {
            return socket.emit("error", { message: "Nie twoja kolej na proponowanie wymiany." });
        }
        // Sprawdzenie, czy gracz już wymieniał w tej turze (jeśli jest takie ograniczenie)
        const proposerTurnState = room.gameState.playerTurnState
            ? room.gameState.playerTurnState[proposingPlayerId]
            : null;
        if (proposerTurnState && (proposerTurnState.hasExchanged || proposerTurnState.hasRolled)) {
            return socket.emit("error", {
                message: "Już wykonałeś akcję wymiany lub rzutu w tej turze.",
            });
        }

        const proposingPlayer = room.players.find((p) => p.id === proposingPlayerId);
        const targetPlayer = room.players.find((p) => p.id === targetPlayerId);

        if (!proposingPlayer || !targetPlayer) {
            return socket.emit("error", { message: "Nie znaleziono gracza." });
        }
        if (proposingPlayerId === targetPlayerId) {
            return socket.emit("error", { message: "Nie możesz handlować sam ze sobą." });
        }

        // Walidacja oferowanych przedmiotów
        if (!playerHasAnimals(proposingPlayer, offeredItems)) {
            return socket.emit("error", { message: "Nie posiadasz oferowanych zwierząt." });
        }
        // Podstawowa walidacja ilości (dodatnie)
        for (const item in offeredItems) {
            if (offeredItems[item] <= 0)
                return socket.emit("error", {
                    message: "Nieprawidłowa ilość oferowanych zwierząt.",
                });
        }
        for (const item in requestedItems) {
            if (requestedItems[item] <= 0)
                return socket.emit("error", { message: "Nieprawidłowa ilość żądanych zwierząt." });
        }

        const tradeId = generateTradeId();
        const newTrade = {
            tradeId,
            proposingPlayerId,
            proposingPlayerNick: proposingPlayer.nick,
            targetPlayerId,
            targetPlayerNick: targetPlayer.nick,
            offeredItems,
            requestedItems,
            timestamp: Date.now(),
            status: "pending_target_response",
        };

        if (!room.gameState.pendingTrades) {
            room.gameState.pendingTrades = {};
        }
        room.gameState.pendingTrades[tradeId] = newTrade;

        // Poinformuj gracza docelowego o ofercie
        const targetSocketId = targetPlayer.socketId;
        if (targetSocketId) {
            io.to(targetSocketId).emit("tradeOfferReceived", {
                tradeId,
                fromPlayerId: proposingPlayerId,
                fromPlayerNick: proposingPlayer.nick,
                offeredItems,
                requestedItems,
            });
            socket.emit("tradeProposalSent", { tradeId, message: "Oferta została wysłana." });
            addLogMessageToRoom(
                room,
                `${proposingPlayer.nick} zaproponował wymianę graczowi ${targetPlayer.nick}.`
            );
            io.to(roomId).emit("roomUpdate", room); // Aktualizacja logów dla wszystkich
        } else {
            // Gracz docelowy nie jest połączony lub błąd
            delete room.gameState.pendingTrades[tradeId];
            socket.emit("error", { message: "Gracz docelowy jest niedostępny." });
        }
    });

    socket.on("respondToTradeOffer", ({ tradeId, accepted }) => {
        const playerData = socketPlayerMap[socket.id];
        if (!playerData) return socket.emit("error", { message: "Błąd identyfikacji gracza." });
        const { playerId: respondingPlayerId, roomId } = playerData;
        const room = getRoom(roomId);

        if (
            !room ||
            !room.gameStarted ||
            !room.gameState.pendingTrades ||
            !room.gameState.pendingTrades[tradeId]
        ) {
            return socket.emit("error", {
                message: "Oferta wymiany nie istnieje lub gra nieaktywna.",
            });
        }

        const trade = room.gameState.pendingTrades[tradeId];
        if (trade.targetPlayerId !== respondingPlayerId) {
            return socket.emit("error", { message: "Nie jesteś adresatem tej oferty." });
        }

        const proposingPlayer = room.players.find((p) => p.id === trade.proposingPlayerId);
        const targetPlayer = room.players.find((p) => p.id === trade.targetPlayerId); // To jest respondingPlayer

        if (!proposingPlayer || !targetPlayer) {
            delete room.gameState.pendingTrades[tradeId];
            return socket.emit("error", {
                message: "Jeden z graczy biorących udział w wymianie jest niedostępny.",
            });
        }

        const proposerSocketId = proposingPlayer.socketId;

        if (accepted) {
            // Ponowna walidacja (kluczowe!)
            if (!playerHasAnimals(proposingPlayer, trade.offeredItems)) {
                if (proposerSocketId)
                    io.to(proposerSocketId).emit("tradeOfferCancelled", {
                        tradeId,
                        reason: `Nie posiadasz już oferowanych zwierząt.`,
                    });
                socket.emit("tradeOfferCancelled", {
                    tradeId,
                    reason: `${proposingPlayer.nick} nie posiada już oferowanych zwierząt.`,
                });
                delete room.gameState.pendingTrades[tradeId];
                addLogMessageToRoom(
                    room,
                    `Wymiana (${tradeId}) anulowana - ${proposingPlayer.nick} nie ma oferowanych zwierząt.`
                );
                io.to(roomId).emit("roomUpdate", room);
                return;
            }
            if (!playerHasAnimals(targetPlayer, trade.requestedItems)) {
                if (proposerSocketId)
                    io.to(proposerSocketId).emit("tradeOfferCancelled", {
                        tradeId,
                        reason: `${targetPlayer.nick} nie posiada już żądanych zwierząt.`,
                    });
                socket.emit("tradeOfferCancelled", {
                    tradeId,
                    reason: `Nie posiadasz już żądanych zwierząt.`,
                });
                delete room.gameState.pendingTrades[tradeId];
                addLogMessageToRoom(
                    room,
                    `Wymiana (${tradeId}) anulowana - ${targetPlayer.nick} nie ma żądanych zwierząt.`
                );
                io.to(roomId).emit("roomUpdate", room);
                return;
            }

            // Dokonaj wymiany
            transferAnimals(proposingPlayer, targetPlayer, trade.offeredItems);
            transferAnimals(targetPlayer, proposingPlayer, trade.requestedItems);

            // Oznacz, że gracz inicjujący (którego jest tura) wykonał akcję wymiany
            if (
                room.gameState.currentPlayerId === proposingPlayer.id &&
                room.gameState.playerTurnState
            ) {
                room.gameState.playerTurnState[proposingPlayer.id].hasExchanged = true;
            }

            delete room.gameState.pendingTrades[tradeId];
            const successMessage = `Wymiana między ${proposingPlayer.nick} a ${targetPlayer.nick} zakończona pomyślnie.`;
            addLogMessageToRoom(room, successMessage);

            if (proposerSocketId) {
                io.to(proposerSocketId).emit("tradeOfferResponse", {
                    tradeId,
                    respondingPlayerId,
                    respondingPlayerNick: targetPlayer.nick,
                    accepted: true,
                    originalOfferDetails: trade, // Możesz chcieć wysłać szczegóły oryginalnej oferty
                });
            }
            // Informacja dla gracza akceptującego (nie jest to standardowe, ale może być pomocne)
            socket.emit("tradeFinalized", {
                tradeId,
                accepted: true,
                message: "Zaakceptowałeś wymianę.",
            });

            // Zaktualizuj stan dla wszystkich w pokoju
            io.to(roomId).emit("tradeCompleted", room); // Lub po prostu 'roomUpdate'
            // io.to(roomId).emit('roomUpdate', room); // To powinno wystarczyć, jeśli roomUpdate aktualizuje wszystko
        } else {
            // Odrzucono
            delete room.gameState.pendingTrades[tradeId];
            addLogMessageToRoom(
                room,
                `${targetPlayer.nick} odrzucił ofertę wymiany od ${proposingPlayer.nick}.`
            );
            if (proposerSocketId) {
                io.to(proposerSocketId).emit("tradeOfferResponse", {
                    tradeId,
                    respondingPlayerId,
                    respondingPlayerNick: targetPlayer.nick,
                    accepted: false,
                });
            }
            socket.emit("tradeFinalized", {
                tradeId,
                accepted: false,
                message: "Odrzuciłeś wymianę.",
            });
            io.to(roomId).emit("roomUpdate", room);
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
                io.to(roomId).emit("turnChange", {
                    nextPlayerId: room.gameState.currentPlayerId,
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
                    removePlayerFromSocketRoom(socket, roomId, playerId);
                    io.to(roomId).emit("playerLeft", {
                        playerId,
                        nick: "Gracz (rozłączony)",
                        roomDetails: room,
                    });
                    io.to(roomId).emit("roomUpdate", room);

                    if (room.gameState && room.gameState.pendingTrades) {
                        Object.values(room.gameState.pendingTrades).forEach((trade) => {
                            if (
                                trade.proposingPlayerId === playerData.playerId ||
                                trade.targetPlayerId === playerData.playerId
                            ) {
                                const otherPlayerId =
                                    trade.proposingPlayerId === playerData.playerId
                                        ? trade.targetPlayerId
                                        : trade.proposingPlayerId;
                                const otherPlayer = room.players.find(
                                    (p) => p.id === otherPlayerId
                                );
                                if (otherPlayer && otherPlayer.socketId) {
                                    io.to(otherPlayer.socketId).emit("tradeOfferCancelled", {
                                        tradeId: trade.tradeId,
                                        reason: `Gracz ${
                                            playerData.nick || "uczestniczący w wymianie"
                                        } rozłączył się.`,
                                    });
                                }
                                delete room.gameState.pendingTrades[trade.tradeId];
                                addLogMessageToRoom(
                                    room,
                                    `Wymiana (${trade.tradeId}) anulowana z powodu rozłączenia gracza.`
                                );
                            }
                        });
                        io.to(playerData.roomId).emit("roomUpdate", room);
                    }

                    if (wasCurrentPlayer && room.gameStarted && room.players.length > 0) {
                        room.gameState.currentPlayerId = determineNextPlayer(room, playerId, true);
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
                            deleteRoom(roomId);
                        }
                    } else if (room.gameStarted && room.players.length < 2) {
                        io.to(roomId).emit('gameEndedNotEnoughPlayers', { roomDetails: room });
                        room.gameStarted = false;
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
