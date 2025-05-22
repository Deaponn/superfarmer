const socket = io();

// Elementy UI
const loginSection = document.getElementById("loginSection");
const nickInput = document.getElementById("nickInput");
const setNickButton = document.getElementById("setNickButton");

const lobbySection = document.getElementById("lobbySection");
const roomNameInput = document.getElementById("roomNameInput");
const createRoomButton = document.getElementById("createRoomButton");
const roomsListUL = document.getElementById("roomsList");

const roomSection = document.getElementById("roomSection");
const currentRoomNameH2 = document.getElementById("currentRoomName");
const playersListDiv = document.getElementById("playersList");
const readyButton = document.getElementById("readyButton");
const gameLogDiv = document.getElementById("gameLog");

const gameBoardSection = document.getElementById("gameBoardSection");
const currentPlayerTurnH3 = document.getElementById("currentPlayerTurn");
const myNickDisplaySpan = document.getElementById("myNickDisplay");
const myAnimalsDiv = document.getElementById("myAnimals");
const otherPlayersAnimalsDiv = document.getElementById("otherPlayersAnimals");
const mainHerdDisplayDiv = document.getElementById("mainHerdDisplay");
const exchangeBankButton = document.getElementById("exchangeBankButton");
const rollDiceButton = document.getElementById("rollDiceButton");
const diceResultDisplayDiv = document.getElementById("diceResultDisplay");

const exchangeModal = document.getElementById("exchangeModal");
const closeExchangeModalButton = exchangeModal.querySelector(".close-button");
const exchangeFromAnimalSelect = document.getElementById("exchangeFromAnimal");
const exchangeFromAmountInput = document.getElementById("exchangeFromAmount");
const exchangeToAnimalSelect = document.getElementById("exchangeToAnimal");
const confirmExchangeButton = document.getElementById("confirmExchangeButton");

let playerId = localStorage.getItem("superfarmer_playerId");
localStorage.setItem("superfarmer_playerId", playerId);
let playerNick = localStorage.getItem("superfarmer_playerNick");
let currentRoomId = null;
let currentRoomDetails = null;

const animalSymbols = {
    /* ... jak na serwerze ... */
};
const allAnimalTypes = ["rabbit", "sheep", "pig", "cow", "horse", "smallDog", "bigDog"];

function populateExchangeSelects() {
    allAnimalTypes.forEach((animal) => {
        let option1 = new Option(`${animalSymbols[animal] || animal}`, animal);
        let option2 = new Option(`${animalSymbols[animal] || animal}`, animal);
        exchangeFromAnimalSelect.add(option1);
        exchangeToAnimalSelect.add(option2);
    });
}

// --- Logowanie i Lobby ---
setNickButton.addEventListener("click", async () => {
    const nick = nickInput.value.trim();
    if (nick) {
        playerNick = nick;
        localStorage.setItem("superfarmer_playerNick", playerNick);
        const response = await fetch("/api/player", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nick }),
        });
        const { playerId: newPlayerId } = await response.json();
        playerId = newPlayerId;
        localStorage.setItem("superfarmer_playerId", playerId);
        loginSection.style.display = "none";
        lobbySection.style.display = "block";
        myNickDisplaySpan.textContent = playerNick;
        fetchRooms();
    } else {
        alert("Podaj nick!");
    }
});
if (playerId && playerNick) {
    nickInput.value = playerNick;
    loginSection.style.display = "none";
    lobbySection.style.display = "block";
    myNickDisplaySpan.textContent = playerNick;
    fetchRooms();
}

async function fetchRooms() {
    try {
        const response = await fetch("/api/rooms");
        const rooms = await response.json();
        roomsListUL.innerHTML = "";
        rooms.forEach((room) => {
            const li = document.createElement("li");
            li.textContent = `${room.name} (${room.playerCount}/${room.maxPlayers}) ${
                room.gameStarted ? "[W TRAKCIE]" : ""
            }`;
            if (!room.gameStarted && room.playerCount < room.maxPlayers) {
                const joinBtn = document.createElement("button");
                joinBtn.textContent = "Dołącz";
                joinBtn.onclick = () => joinRoom(room.id);
                li.appendChild(joinBtn);
            }
            roomsListUL.appendChild(li);
        });
    } catch (err) {
        console.error("Błąd pobierania pokoi:", err);
    }
}

createRoomButton.addEventListener("click", async () => {
    const name = roomNameInput.value.trim();
    if (name) {
        try {
            const response = await fetch("/api/rooms", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
            });
            const newRoom = await response.json();
            if (response.ok) {
                joinRoom(newRoom.id); // Po stworzeniu, dołącz
            } else {
                alert(`Błąd tworzenia pokoju: ${newRoom.message}`);
            }
        } catch (err) {
            console.error("Błąd tworzenia pokoju:", err);
        }
    } else {
        alert("Podaj nazwę pokoju.");
    }
});

async function joinRoom(roomId) {
    try {
        const response = await fetch(`/api/rooms/${roomId}/join`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ playerId, playerNick }),
        });
        const data = await response.json();
        if (data.success) {
            currentRoomId = roomId;
            lobbySection.style.display = "none";
            roomSection.style.display = "block";
            gameLogDiv.innerHTML = ""; // Wyczyść logi
            addLogMessage(`Dołączanie do pokoju ${data.roomDetails.name}...`);
            socket.emit("joinRoom", { roomId, playerId, playerNick });
        } else {
            alert(`Nie udało się dołączyć: ${data.message}`);
        }
    } catch (err) {
        console.error("Błąd dołączania do pokoju przez API:", err);
    }
}

// --- Obsługa UI Pokoju i Gry ---
function addLogMessage(message, type = "info") {
    const p = document.createElement("p");
    p.innerHTML = message; // Użyj innerHTML by emotikony się renderowały
    p.className = `log-${type}`;
    gameLogDiv.appendChild(p);
    gameLogDiv.scrollTop = gameLogDiv.scrollHeight;
}

function updateRoomView(room) {
    currentRoomDetails = room; // Zapisz globalnie
    currentRoomNameH2.textContent = `Pokój: ${room.name}`;
    playersListDiv.innerHTML = "<h4>Gracze:</h4>";
    room.players.forEach((p) => {
        const playerDiv = document.createElement("div");
        playerDiv.innerHTML = `${p.nick} ${p.id === playerId ? "(Ty)" : ""} - ${
            p.isReady ? "✔️ Gotowy" : "⏳ Oczekuje"
        }`;
        if (room.gameStarted && room.gameState && room.gameState.currentPlayerId === p.id) {
            playerDiv.innerHTML += " 🎯 (Jego tura)";
        }
        playersListDiv.appendChild(playerDiv);
    });

    const me = room.players.find((p) => p.id === playerId);
    if (me) {
        readyButton.textContent = me.isReady ? "Anuluj Gotowość" : "Jestem Gotów!";
        readyButton.disabled = room.gameStarted || (room.players.length < 2 && !me.isReady); // Nie można być gotowym samemu
    }

    if (room.gameStarted) {
        roomSection.style.display = "none";
        gameBoardSection.style.display = "block";
        updateGameBoardView(room);
    } else {
        roomSection.style.display = "block";
        gameBoardSection.style.display = "none";
    }
}

function updateGameBoardView(room) {
    const me = room.players.find((p) => p.id === playerId);
    if (me) {
        myAnimalsDiv.innerHTML = Object.entries(me.animals)
            .map(([animal, count]) => `<span>${animalSymbols[animal] || animal}: ${count}</span>`)
            .join("<br>");
    }

    otherPlayersAnimalsDiv.innerHTML = "<h4>Zwierzęta Innych Graczy:</h4>";
    room.players
        .filter((p) => p.id !== playerId)
        .forEach((otherPlayer) => {
            otherPlayersAnimalsDiv.innerHTML +=
                `<p><b>${otherPlayer.nick}:</b><br>` +
                Object.entries(otherPlayer.animals)
                    .map(
                        ([animal, count]) =>
                            `<span>${animalSymbols[animal] || animal}: ${count}</span>`
                    )
                    .join(", ") +
                "</p>";
        });

    if (room.gameState && room.gameState.mainHerd) {
        mainHerdDisplayDiv.innerHTML =
            "<h4>Stado Główne (Bank):</h4>" +
            Object.entries(room.gameState.mainHerd)
                .map(
                    ([animal, count]) => `<span>${animalSymbols[animal] || animal}: ${count}</span>`
                )
                .join("<br>");
    }

    const isMyTurn = room.gameState && room.gameState.currentPlayerId === playerId;
    const turnState = room.gameState ? room.gameState.playerTurnState[playerId] : null;

    exchangeBankButton.disabled =
        !isMyTurn || (turnState && turnState.hasExchanged) || (turnState && turnState.hasRolled);
    rollDiceButton.disabled = !isMyTurn || (turnState && turnState.hasRolled);

    const currentPlayer = room.players.find((p) => p.id === room.gameState?.currentPlayerId);
    currentPlayerTurnH3.textContent = `Tura gracza: ${currentPlayer ? currentPlayer.nick : "N/A"}`;
}

// --- Akcje Gracza ---
readyButton.addEventListener("click", () => {
    socket.emit("playerReady");
});

rollDiceButton.addEventListener("click", () => {
    diceResultDisplayDiv.innerHTML = ""; // Wyczyść poprzedni wynik
    socket.emit("rollDice");
});

exchangeBankButton.addEventListener("click", () => {
    populateExchangeSelects(); // Załaduj opcje do selectów
    exchangeModal.style.display = "block";
});
closeExchangeModalButton.onclick = () => (exchangeModal.style.display = "none");
confirmExchangeButton.addEventListener("click", () => {
    const exchange = {
        fromAnimal: exchangeFromAnimalSelect.value,
        fromAmount: exchangeFromAmountInput.value,
        toAnimal: exchangeToAnimalSelect.value,
    };
    socket.emit("exchangeWithBank", { exchange });
    exchangeModal.style.display = "none";
});

// --- WebSocket Event Handlers ---
socket.on("connect", () => addLogMessage("Połączono z serwerem.", "success"));
socket.on("disconnect", () => addLogMessage("Rozłączono z serwerem.", "error"));
socket.on("error", (data) => {
    alert(`Błąd serwera: ${data.message}`);
    addLogMessage(`Błąd: ${data.message}`, "error");
});

socket.on("joinedRoom", (room) => {
    addLogMessage(`Dołączyłeś do pokoju: ${room.name}.`, "event");
    updateRoomView(room);
});

socket.on("roomUpdate", (room) => {
    addLogMessage("Stan pokoju zaktualizowany.", "info");
    updateRoomView(room);
});

socket.on("playerLeft", ({ playerId: pId, nick, roomDetails }) => {
    addLogMessage(`Gracz ${nick || pId} opuścił pokój.`, "info");
    updateRoomView(roomDetails);
});

socket.on("gameStarting", (room) => {
    addLogMessage("Gra się rozpoczyna!", "event-important");
    updateRoomView(room); // Przełączy widok na planszę gry
});

socket.on("diceRollResult", (data) => {
    const { nick, diceResult, log, updatedRoom } = data;
    diceResultDisplayDiv.innerHTML = `Gracz ${nick} wyrzucił: ${
        animalSymbols[diceResult.die1] || diceResult.die1
    } i ${animalSymbols[diceResult.die2] || diceResult.die2}`;
    log.forEach((msg) => addLogMessage(msg, "game"));
    updateGameBoardView(updatedRoom); // Zaktualizuj stan planszy
    currentRoomDetails = updatedRoom; // Zapisz nowy stan
});

socket.on("bankExchangeResult", (data) => {
    const { success, log, updatedRoom } = data;
    if (success) {
        addLogMessage(log, "game");
        updateGameBoardView(updatedRoom);
        currentRoomDetails = updatedRoom;
    } else {
        alert(`Wymiana nieudana: ${log}`);
    }
});

socket.on("turnChange", ({ nextPlayerNick, roomDetails }) => {
    addLogMessage(`Następna tura: ${nextPlayerNick || "N/A"}`, "event");
    updateGameBoardView(roomDetails);
    currentRoomDetails = roomDetails;
});

socket.on("gameOver", ({ winnerNick, roomDetails }) => {
    addLogMessage(`KONIEC GRY! Wygrywa ${winnerNick}! 🎉`, "event-important");
    updateGameBoardView(roomDetails); // Pokaż finalny stan
    // Zablokuj przyciski akcji
    exchangeBankButton.disabled = true;
    rollDiceButton.disabled = true;
    readyButton.style.display = "block"; // Można by zmienić na "Nowa Gra"
    readyButton.textContent = "Zacznij Nową Grę (Odśwież)";
    readyButton.onclick = () => window.location.reload();
});

window.onload = () => {
    if (playerNick) {
        nickInput.value = playerNick;
        setNickButton.click(); // Automatyczne "ustawienie" nicku i przejście do lobby
    }
};
