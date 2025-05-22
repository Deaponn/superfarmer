import React, { useState, useEffect, useCallback } from "react";
import { socket } from "./socketInstance"; // Import instancji socketu
import LoginSection from "./components/LoginSection";
import LobbySection from "./components/LobbySection";
import RoomSection from "./components/RoomSection";
import GameBoardSection from "./components/GameBoardSection";
import { animalSymbols as appAnimalSymbols } from "./constants"; // Zmień nazwę, aby uniknąć konfliktu
import "./index.css"; // Zaimportuj swoje style

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

    const animalSymbols = appAnimalSymbols; // Użyj zaimportowanych symboli

    const addLogMessage = useCallback((message, type = "info") => {
        setGameLog((prevLog) => [
            ...prevLog,
            { text: message, type, id: Date.now() + Math.random() },
        ]);
    }, []);

    useEffect(() => {
        // Automatyczne logowanie jeśli dane są w localStorage
        if (
            localStorage.getItem("superfarmer_playerId") &&
            localStorage.getItem("superfarmer_playerNick") && false
        ) {
            setPlayerId(localStorage.getItem("superfarmer_playerId"));
            const nick = localStorage.getItem("superfarmer_playerNick");
            setPlayerNick(nick);
            // Symulacja /api/player (w oryginalnym kodzie nie było zapytania po nicku przy odświeżeniu)
            // Jeśli serwer oczekuje zapytania /api/player przy każdym starcie, dodaj je tutaj.
            // W tej wersji zakładamy, że serwer akceptuje playerId i playerNick wysyłane przy dołączaniu do pokoju.
            setView("lobby");
        }
    }, []);

    useEffect(() => {
        // Ustawienie nasłuchiwaczy Socket.IO
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
                setView("room"); // Powrót do lobby pokoju jeśli gra się zakończyła
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
            setGameLog([]); // Wyczyść logi z lobby
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
            // Można by ustawić specjalny widok 'gameOver' lub zablokować przyciski w GameBoard
        });

        return () => {
            // Czyszczenie nasłuchiwaczy przy odmontowywaniu komponentu
            socket.off("connect");
            socket.off("disconnect");
            socket.off("error");
            socket.off("joinedRoom");
            socket.off("roomUpdate");
            socket.off("playerLeft");
            socket.off("gameStarting");
            socket.off("diceRollResult");
            socket.off("bankExchangeResult");
            socket.off("turnChange");
            socket.off("gameOver");
        };
    }, [addLogMessage, view, animalSymbols]); // Dodaj animalSymbols do zależności jeśli są dynamiczne

    const handleSetNick = async (nick) => {
        try {
            // W oryginalnym kodzie klienta, endpoint /api/player był wywoływany
            // i zwracał nowy playerId. Jeśli serwer tego oczekuje, zostawiamy to.
            // Jeśli serwer akceptuje playerId z localStorage, to zapytanie można uprościć
            // lub usunąć, jeśli playerId jest generowany tylko raz na początku.
            const response = await fetch("/api/player", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nick }),
            });
            // Załóżmy, że serwer zwraca `playerId` lub potwierdzenie.
            // W oryginalnym kodzie klienta `playerId` był nadpisywany odpowiedzią.
            const { playerId } = await response.json(); // Może zawierać playerId lub tylko wiadomość

            // Jeśli serwer generuje nowy playerId po ustawieniu nicka:
            // const newPlayerId = data.playerId; // Jeśli serwer zwraca playerId
            // setPlayerId(newPlayerId);
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
                // Serwer oczekuje playerId i playerNick przy tworzeniu pokoju
                body: JSON.stringify({ name: roomName }),
            });
            const newRoom = await response.json();
            if (response.ok) {
                // Po stworzeniu, dołącz do pokoju przez API, a potem przez WebSocket
                console.log("joining", newRoom);
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
                // setView i setCurrentRoom zostaną obsłużone przez socket.on('joinedRoom')
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
        setDiceResultDisplay(""); // Wyczyść poprzedni wynik
        socket.emit("rollDice");
    };

    const handleExchangeWithBank = (exchangeDetails) => {
        // exchangeDetails = { fromAnimal, fromAmount, toAnimal }
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
                    onExchangeWithBank={handleExchangeWithBank}
                    gameLog={gameLog}
                    diceResultDisplay={diceResultDisplay}
                    animalSymbols={animalSymbols}
                />
            )}
        </div>
    );
}

export default App;
