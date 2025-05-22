import React from "react";

function RoomSection({ room, playerId, onPlayerReady, gameLog }) {
    const me = room.players.find((p) => p.id === playerId);

    return (
        <div id="roomSection">
            <h2 id="currentRoomName">Pokój: {room.name}</h2>
            <div id="playersList">
                <h4>Gracze:</h4>
                {room.players.map((p) => (
                    <div key={p.id}>
                        {p.nick} {p.id === playerId ? "(Ty)" : ""} -
                        {p.isReady ? " ✔️ Gotowy" : " ⏳ Oczekuje"}
                        {room.gameStarted &&
                            room.gameState &&
                            room.gameState.currentPlayerId === p.id &&
                            " 🎯 (Jego tura)"}
                    </div>
                ))}
            </div>
            {!room.gameStarted && me && (
                <button
                    id="readyButton"
                    onClick={onPlayerReady}
                    disabled={room.players.length < 2 && !me.isReady}
                >
                    {me.isReady ? "Anuluj Gotowość" : "Jestem Gotów!"}
                </button>
            )}
            <div
                id="gameLog"
                style={{
                    maxHeight: "200px",
                    overflowY: "auto",
                    border: "1px solid #ccc",
                    padding: "10px",
                    marginTop: "10px",
                }}
            >
                {gameLog.map((logEntry) => (
                    <p
                        key={logEntry.id}
                        className={`log-${logEntry.type}`}
                        dangerouslySetInnerHTML={{ __html: logEntry.text }}
                    ></p>
                ))}
            </div>
        </div>
    );
}

export default RoomSection;
