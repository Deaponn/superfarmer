import React, { useState } from "react";

function LobbySection({ rooms, onCreateRoom, onJoinRoom, onRefreshRooms }) {
    const [roomName, setRoomName] = useState("");

    const handleCreate = () => {
        onCreateRoom(roomName);
        setRoomName("");
    };

    return (
        <div id="lobbySection">
            <h3>Lobby</h3>
            <div>
                <input
                    type="text"
                    id="roomNameInput"
                    placeholder="Nazwa nowego pokoju"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                />
                <button id="createRoomButton" onClick={handleCreate}>
                    Stwórz Pokój
                </button>
            </div>
            <h4>
                Dostępne Pokoje:{" "}
                <button onClick={onRefreshRooms} style={{ marginLeft: "10px", fontSize: "0.8em" }}>
                    Odśwież
                </button>
            </h4>
            <ul id="roomsList">
                {rooms.length === 0 && <p>Brak dostępnych pokoi. Stwórz własny!</p>}
                {rooms.map((room) => (
                    <li key={room.id}>
                        {`${room.name} (${room.playerCount}/${room.maxPlayers}) ${
                            room.gameStarted ? "[W TRAKCIE]" : ""
                        }`}
                        {!room.gameStarted && room.playerCount < room.maxPlayers && (
                            <button
                                onClick={() => onJoinRoom(room.id)}
                                style={{ marginLeft: "10px" }}
                            >
                                Dołącz
                            </button>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default LobbySection;
