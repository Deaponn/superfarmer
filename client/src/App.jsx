import React, { useState, useEffect, useCallback } from "react";
import { socket } from "./socketInstance";
import LoginSection from "./components/LoginSection";
import LobbySection from "./components/LobbySection";
import RoomSection from "./components/RoomSection";
import GameBoardSection from "./components/GameBoardSection";
import ProposeTradeModal from './components/ProposeTradeModal';
import IncomingTradeModal from './components/IncomingTradeModal';
import { animalSymbols as appAnimalSymbols } from "./constants";
import "./index.css";

function App() {
    const [view, setView] = useState("login"); // 'login', 'lobby', 'room', 'game'
    const [playerId, setPlayerId] = useState(localStorage.getItem("superfarmer_playerId") || "");
    const [playerNick, setPlayerNick] = useState(
        localStorage.getItem("superfarmer_playerNick") || ""
    );
    const [currentRoom, setCurrentRoom] = useState(null);
    const [rooms, setRooms] = useState([]);
    const [gameLog, setGameLog] = useState([]);
    const [diceResultDisplay, setDiceResultDisplay] = useState("");
    const [outgoingTrade, setOutgoingTrade] = useState(null); // { tradeId, targetPlayerId, offered, requested }
    const [incomingTrades, setIncomingTrades] = useState([]); // [{ tradeId, fromPlayerId, fromPlayerNick, offeredItems, requestedItems }]

    const animalSymbols = appAnimalSymbols;

    const addLogMessage = useCallback((message, type = "info") => {
        setGameLog((prevLog) => [
            ...prevLog,
            { text: message, type, id: Date.now() + Math.random() },
        ]);
    }, []);

    useEffect(() => {
        if (
            localStorage.getItem("superfarmer_playerId") &&
            localStorage.getItem("superfarmer_playerNick") && false // TODO: remove && false
        ) {
            setPlayerId(localStorage.getItem("superfarmer_playerId"));
            setPlayerNick(localStorage.getItem("superfarmer_playerNick"));
            setView("lobby");
        }
    }, []);

    useEffect(() => {
        socket.on("connect", () => addLogMessage("Połączono z serwerem.", "success"));
        socket.on("disconnect", () => addLogMessage("Rozłączono z serwerem.", "error"));
        socket.on("error", (data) => {
            alert(`Błąd serwera: ${data.message}`);
            addLogMessage(`Błąd: ${data.message}`, "error");
        });
        socket.on("joinedRoom", (roomDetails) => {
            addLogMessage(`Dołączyłeś do pokoju: ${roomDetails.name}.`, "event");
            setCurrentRoom(roomDetails);
            setView("room");
        });
        socket.on("roomUpdate", (roomDetails) => {
            addLogMessage("Stan pokoju zaktualizowany.", "info");
            setCurrentRoom(roomDetails);
            if (roomDetails.gameStarted && view !== "game") {
                setView("game");
            } else if (!roomDetails.gameStarted && view === "game") {
                setView("room");
            }
        });
        socket.on("playerLeft", ({ nick, roomDetails }) => {
            addLogMessage(`Gracz ${nick || "Nieznany"} opuścił pokój.`, "info");
            setCurrentRoom(roomDetails);
        });
        socket.on("gameStarting", (roomDetails) => {
            addLogMessage("Gra się rozpoczyna!", "event-important");
            setCurrentRoom(roomDetails);
            setView("game");
            setGameLog([]);
        });
        socket.on("diceRollResult", (data) => {
            const { nick: rollerNick, diceResult, log, updatedRoom } = data;
            setDiceResultDisplay(
                `Gracz ${rollerNick} wyrzucił: ${
                    animalSymbols[diceResult.die1] || diceResult.die1
                } i ${animalSymbols[diceResult.die2] || diceResult.die2}`
            );
            log.forEach((msg) => addLogMessage(msg, "game"));
            setCurrentRoom(updatedRoom);
        });

        socket.on('tradeOfferReceived', (tradeOffer) => {
            addLogMessage(`Otrzymałeś ofertę wymiany od ${tradeOffer.fromPlayerNick}.`, 'event');
            setIncomingTrades(prevTrades => [...prevTrades, tradeOffer]);
        });

        socket.on('tradeOfferResponse', ({ tradeId, respondingPlayerNick, accepted, originalOfferDetails }) => {
            if (outgoingTrade && outgoingTrade.tradeId === tradeId) {
                setOutgoingTrade(null); // Wyczyść wysłaną ofertę
            }
            if (accepted) {
                addLogMessage(`Gracz ${respondingPlayerNick} zaakceptował Twoją ofertę wymiany.`, 'success');
                // Stan gry (zwierzęta) powinien być zaktualizowany przez 'roomUpdate' lub dedykowany 'tradeCompleted'
            } else {
                addLogMessage(`Gracz ${respondingPlayerNick} odrzucił Twoją ofertę wymiany.`, 'info');
            }
        });

        socket.on('tradeCompleted', (updatedRoomData) => { // Serwer może wysłać cały zaktualizowany pokój
            addLogMessage('Wymiana zakończona pomyślnie.', 'event');
            setCurrentRoom(updatedRoomData); // Aktualizacja całego stanu pokoju
            // Jeśli serwer wysyła tylko zaktualizowane dane graczy:
            // setCurrentRoom(prevRoom => ({
            // ...prevRoom,
            // players: prevRoom.players.map(p => /* zaktualizuj graczy biorących udział w wymianie */)
            // }));
        });

        socket.on('tradeOfferCancelled', ({ tradeId, reason }) => {
            addLogMessage(`Oferta wymiany (${tradeId}) została anulowana: ${reason}`, 'warning');
            setIncomingTrades(prev => prev.filter(t => t.tradeId !== tradeId));
            if (outgoingTrade && outgoingTrade.tradeId === tradeId) {
                setOutgoingTrade(null);
            }
        });
        socket.on("bankExchangeResult", (data) => {
            const { success, log, updatedRoom } = data;
            if (success) {
                addLogMessage(log, "game");
                setCurrentRoom(updatedRoom);
            } else {
                alert(`Wymiana nieudana: ${log}`);
                addLogMessage(`Wymiana nieudana: ${log}`, "error");
            }
        });
        socket.on("turnChange", ({ nextPlayerNick, roomDetails }) => {
            addLogMessage(`Następna tura: ${nextPlayerNick || "N/A"}`, "event");
            setCurrentRoom(roomDetails);
        });
        socket.on("gameOver", ({ winnerNick, roomDetails }) => {
            addLogMessage(`KONIEC GRY! Wygrywa ${winnerNick}! 🎉`, "event-important");
            setCurrentRoom(roomDetails);
        });

        return () => {
            socket.off("connect");
            socket.off("disconnect");
            socket.off("error");
            socket.off("joinedRoom");
            socket.off("roomUpdate");
            socket.off("playerLeft");
            socket.off("gameStarting");
            socket.off("diceRollResult");
            socket.off('tradeOfferReceived');
            socket.off('tradeOfferResponse');
            socket.off('tradeCompleted');
            socket.off('tradeOfferCancelled');
            socket.off("bankExchangeResult");
            socket.off("turnChange");
            socket.off("gameOver");
        };
    }, [addLogMessage, view, animalSymbols, addLogMessage, outgoingTrade]);

    const handleSetNick = async (nick) => {
        try {
            const response = await fetch("/api/player", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nick }),
            });
            const { playerId } = await response.json();

            setPlayerId(playerId);
            localStorage.setItem("superfarmer_playerId", playerId);

            setPlayerNick(nick);
            localStorage.setItem("superfarmer_playerNick", nick);
            setView("lobby");
        } catch (error) {
            console.error("Błąd podczas ustawiania nicku:", error);
            alert("Nie udało się ustawić nicku. Spróbuj ponownie.");
        }
    };

    const fetchRoomsList = useCallback(async () => {
        try {
            const response = await fetch("/api/rooms");
            const data = await response.json();
            setRooms(data);
        } catch (err) {
            console.error("Błąd pobierania pokoi:", err);
            addLogMessage("Nie udało się pobrać listy pokoi.", "error");
        }
    }, [addLogMessage]);

    useEffect(() => {
        if (view === "lobby") {
            fetchRoomsList();
        }
    }, [view, fetchRoomsList]);

    const handleCreateRoom = async (roomName) => {
        if (!roomName) {
            alert("Podaj nazwę pokoju.");
            return;
        }
        try {
            const response = await fetch("/api/rooms", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: roomName }),
            });
            const newRoom = await response.json();
            if (response.ok) {
                handleJoinRoom(newRoom.id);
            } else {
                alert(`Błąd tworzenia pokoju: ${newRoom.message}`);
            }
        } catch (err) {
            console.error("Błąd tworzenia pokoju:", err);
            addLogMessage("Nie udało się stworzyć pokoju.", "error");
        }
    };

    const handleJoinRoom = async (roomId) => {
        try {
            const response = await fetch(`/api/rooms/${roomId}/join`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ playerId, playerNick }),
            });
            const data = await response.json();
            if (data.success) {
                addLogMessage(`Dołączanie do pokoju ${data.roomDetails.name}...`);
                socket.emit("joinRoom", { roomId, playerId, playerNick });
            } else {
                alert(`Nie udało się dołączyć: ${data.message}`);
                addLogMessage(`Nie udało się dołączyć: ${data.message}`, "error");
            }
        } catch (err) {
            console.error("Błąd dołączania do pokoju przez API:", err);
            addLogMessage("Błąd sieci przy dołączaniu do pokoju.", "error");
        }
    };

    const handlePlayerReady = () => {
        if (currentRoom && !currentRoom.gameStarted) {
            socket.emit("playerReady");
        }
    };

    const handleRollDice = () => {
        setDiceResultDisplay("");
        socket.emit("rollDice");
    };

    const handleProposeTrade = (tradeDetails) => { // { targetPlayerId, offeredItems, requestedItems }
        if (!currentRoom || !currentRoom.gameStarted || currentRoom.gameState.currentPlayerId !== playerId) {
            alert("Nie możesz teraz zaproponować wymiany.");
            return;
        }
        // Tutaj serwer powinien nadać tradeId i zapisać ofertę
        // Klient tylko wysyła propozycję
        socket.emit('proposeTradeToPlayer', tradeDetails);
        // Można ustawić stan outgoingTrade tymczasowo, a serwer potwierdzi z tradeId
        // lub poczekać na potwierdzenie od serwera, że oferta została wysłana
        addLogMessage(`Wysyłanie propozycji wymiany do gracza ${tradeDetails.targetPlayerId}...`, 'info');
        // Dla uproszczenia, zakładamy, że serwer nada tradeId i ewentualnie
        // odeśle potwierdzenie wysłania oferty, lub po prostu gracz będzie czekał na odpowiedź.
        // Można by tu ustawić np. setOutgoingTrade({ ...tradeDetails, status: 'pending_server_ack' });
    };

    const handleRespondToTrade = (tradeId, accepted) => {
        socket.emit('respondToTradeOffer', { tradeId, accepted });
        setIncomingTrades(prevTrades => prevTrades.filter(trade => trade.tradeId !== tradeId));
    };

    const handleExchangeWithBank = (exchangeDetails) => {
        socket.emit("exchangeWithBank", { exchange: exchangeDetails });
    };

    return (
        <div className="App">
            {view === "login" && (
                <LoginSection onSetNick={handleSetNick} initialNick={playerNick} />
            )}
            {view === "lobby" && (
                <LobbySection
                    rooms={rooms}
                    onCreateRoom={handleCreateRoom}
                    onJoinRoom={handleJoinRoom}
                    onRefreshRooms={fetchRoomsList}
                />
            )}
            {view === "room" && currentRoom && (
                <RoomSection
                    room={currentRoom}
                    playerId={playerId}
                    onPlayerReady={handlePlayerReady}
                    gameLog={gameLog}
                />
            )}
            {view === "game" && currentRoom && currentRoom.gameState && (
                <GameBoardSection
                    room={currentRoom}
                    playerId={playerId}
                    playerNick={playerNick}
                    onRollDice={handleRollDice}
                    onProposeTrade={handleProposeTrade}
                    onExchangeWithBank={handleExchangeWithBank}
                    gameLog={gameLog}
                    diceResultDisplay={diceResultDisplay}
                    animalSymbols={animalSymbols}
                />
            )}
            {incomingTrades.map(trade => (
                <IncomingTradeModal
                    key={trade.tradeId}
                    tradeOffer={trade}
                    onRespond={handleRespondToTrade}
                    animalSymbols={animalSymbols}
                />
            ))}
        </div>
    );
}

export default App;
