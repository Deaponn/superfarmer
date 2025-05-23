import React, { useState } from "react";
import AnimalDisplay from "./AnimalDisplay";
import ExchangeModal from "./ExchangeModal";
import ProposeTradeModal from "./ProposeTradeModal";

function GameBoardSection({
    room,
    playerId,
    playerNick,
    onRollDice,
    onProposeTrade,
    onExchangeWithBank,
    gameLog,
    diceResultDisplay,
    animalSymbols,
}) {
    const [isExchangeModalOpen, setIsExchangeModalOpen] = useState(false);
    const [isProposeTradeModalOpen, setIsProposeTradeModalOpen] = useState(false);

    const me = room.players.find((p) => p.id === playerId);
    const currentPlayer = room.players.find((p) => p.id === room.gameState.currentPlayerId);
    const isMyTurn = room.gameState.currentPlayerId === playerId;

    const turnState = room.gameState.playerTurnState
        ? room.gameState.playerTurnState[playerId]
        : { hasExchanged: false, hasRolled: false };
    const canPerformAnyExchange = isMyTurn && !turnState.hasExchanged && !turnState.hasRolled;
    const canRoll = isMyTurn && !turnState.hasRolled;

    if (!me) return <p>Błąd: Nie znaleziono gracza...</p>;

    const handleOpenExchangeModal = () => setIsExchangeModalOpen(true);
    const handleCloseExchangeModal = () => setIsExchangeModalOpen(false);
    const handleConfirmExchange = (exchangeDetails) => {
        onExchangeWithBank(exchangeDetails);
    };

    const handleOpenProposeTradeModal = () => setIsProposeTradeModalOpen(true);
    const handleCloseProposeTradeModal = () => setIsProposeTradeModalOpen(false);
    const handleConfirmProposeTrade = (tradeDetails) => {
        // { targetPlayerId, offeredItems, requestedItems }
        onProposeTrade(tradeDetails);
        // Potencjalnie ustawić turnState.hasExchanged = true
    };

    return (
        <div id="gameBoardSection">
            <h3 id="currentPlayerTurn">
                Tura gracza: {currentPlayer ? currentPlayer.nick : "N/A"}
            </h3>

            <div className="game-layout">
                <div className="player-column">
                    <div className="player-hud">
                        <AnimalDisplay
                            animals={me.animals}
                            animalSymbols={animalSymbols}
                            title={`Twoje Zwierzęta (${playerNick})`}
                        />
                    </div>
                    <div id="mainHerdDisplay" style={{ marginTop: "20px" }}>
                        <AnimalDisplay
                            animals={room.gameState.mainHerd}
                            animalSymbols={animalSymbols}
                            title="Stado Główne (Bank)"
                        />
                    </div>
                </div>

                <div className="center-column">
                    <div id="actions">
                        <button
                            id="exchangeBankButton"
                            onClick={handleOpenExchangeModal}
                            disabled={!canPerformAnyExchange}
                        >
                            Wymień z Bankiem
                        </button>
                        <button
                            id="proposeTradePlayerButton"
                            onClick={handleOpenProposeTradeModal}
                            disabled={!canPerformAnyExchange || room.players.length < 2}
                        >
                            Wymień z Graczem
                        </button>
                        <button id="rollDiceButton" onClick={onRollDice} disabled={!canRoll}>
                            Rzuć Kością
                        </button>
                    </div>
                    {diceResultDisplay && (
                        <div
                            id="diceResultDisplay"
                            style={{ marginTop: "10px", fontWeight: "bold" }}
                        >
                            {diceResultDisplay}
                        </div>
                    )}
                    <div
                        id="gameLog"
                        style={{
                            maxHeight: "300px",
                            overflowY: "auto",
                            border: "1px solid #ccc",
                            padding: "10px",
                            marginTop: "10px",
                            textAlign: "left",
                        }}
                    >
                        {gameLog.slice(-10).map((logEntry) => (
                            <p
                                key={logEntry.id}
                                className={`log-${logEntry.type}`}
                                dangerouslySetInnerHTML={{ __html: logEntry.text }}
                            ></p>
                        ))}
                    </div>
                </div>

                <div className="other-players-column">
                    <div id="otherPlayersAnimals">
                        <h4>Zwierzęta Innych Graczy:</h4>
                        {room.players
                            .filter((p) => p.id !== playerId)
                            .map((otherPlayer) => (
                                <div key={otherPlayer.id} style={{ marginBottom: "15px" }}>
                                    <AnimalDisplay
                                        animals={otherPlayer.animals}
                                        animalSymbols={animalSymbols}
                                        title={otherPlayer.nick}
                                    />
                                </div>
                            ))}
                    </div>
                </div>
            </div>

            <ExchangeModal
                isOpen={isExchangeModalOpen}
                onClose={handleCloseExchangeModal}
                onConfirmExchange={handleConfirmExchange}
                playerAnimals={me.animals}
                bankAnimals={room.gameState.mainHerd}
            />
            <ProposeTradeModal
                isOpen={isProposeTradeModalOpen}
                onClose={handleCloseProposeTradeModal}
                onConfirmPropose={handleConfirmProposeTrade}
                myAnimals={me.animals}
                otherPlayers={room.players.filter((p) => p.id !== playerId)} // Przekaż listę innych graczy
                animalSymbols={animalSymbols}
            />
        </div>
    );
}

export default GameBoardSection;
