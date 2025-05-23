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
    const currentPlayer = room.gameState.currentPlayerId;
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
        onProposeTrade(tradeDetails);
    };

    return (
        <div id="gameBoardSection">
            <div className="game-layout">
                <div className="top-game-row">
                    <div id="otherPlayersAnimals">
                        {room.players.length >= 4 &&
                            (function (otherPlayer) {
                                return (
                                    <div
                                        key={otherPlayer.id}
                                        style={{
                                            border:
                                                currentPlayer === otherPlayer.id
                                                    ? "3px solid blue"
                                                    : "",
                                        }}
                                    >
                                        <AnimalDisplay
                                            animals={otherPlayer.animals}
                                            animalSymbols={animalSymbols}
                                            title={otherPlayer.nick}
                                        />
                                    </div>
                                );
                            })(room.players.filter((p) => p.id !== playerId)[2])}
                    </div>
                </div>
                <div className="middle-game-row">
                    <div
                        className="player-hud"
                        style={{
                            border: currentPlayer === playerId ? "3px solid blue" : "",
                        }}
                    >
                        <AnimalDisplay
                            animals={me.animals}
                            animalSymbols={animalSymbols}
                            title={`Twoje Zwierzęta (${playerNick})`}
                        />
                    </div>
                    <div id="mainHerdDisplay">
                        <AnimalDisplay
                            animals={room.gameState.mainHerd}
                            animalSymbols={animalSymbols}
                            title="Stado Główne (Bank)"
                        />
                    </div>
                    <div id="otherPlayersAnimals">
                        {room.players.length >= 2 &&
                            (function (otherPlayer) {
                                return (
                                    <div
                                        key={otherPlayer.id}
                                        style={{
                                            border:
                                                currentPlayer === otherPlayer.id
                                                    ? "3px solid blue"
                                                    : "",
                                        }}
                                    >
                                        <AnimalDisplay
                                            animals={otherPlayer.animals}
                                            animalSymbols={animalSymbols}
                                            title={otherPlayer.nick}
                                        />
                                    </div>
                                );
                            })(room.players.filter((p) => p.id !== playerId)[0])}
                    </div>
                </div>
                <div className="bottom-game-row">
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
                    <div id="otherPlayersAnimals">
                        {room.players.length >= 3 &&
                            (function (otherPlayer) {
                                return (
                                    <div
                                        key={otherPlayer.id}
                                        style={{
                                            border:
                                                currentPlayer === otherPlayer.id
                                                    ? "3px solid blue"
                                                    : "",
                                        }}
                                    >
                                        <AnimalDisplay
                                            animals={otherPlayer.animals}
                                            animalSymbols={animalSymbols}
                                            title={otherPlayer.nick}
                                        />
                                    </div>
                                );
                            })(room.players.filter((p) => p.id !== playerId)[1])}
                    </div>
                    <div>
                        <div id="actions">
                            <button
                                id="exchangeBankButton"
                                onClick={handleOpenExchangeModal}
                                disabled={!canPerformAnyExchange}
                                style={{
                                    cursor: !canPerformAnyExchange ? "not-allowed" : "pointer",
                                }}
                            >
                                Wymień z Bankiem
                            </button>
                            <button
                                id="proposeTradePlayerButton"
                                onClick={handleOpenProposeTradeModal}
                                disabled={!canPerformAnyExchange || room.players.length < 2}
                                style={{
                                    cursor:
                                        !canPerformAnyExchange || room.players.length < 2
                                            ? "not-allowed"
                                            : "pointer",
                                }}
                            >
                                Wymień z Graczem
                            </button>
                            <button
                                id="rollDiceButton"
                                onClick={onRollDice}
                                disabled={!canRoll}
                                style={{ cursor: !canRoll ? "not-allowed" : "pointer" }}
                            >
                                Rzuć Kością
                            </button>
                        </div>
                        {diceResultDisplay ? (
                            <div id="diceResultDisplay">{diceResultDisplay}</div>
                        ) : (
                            <div id="diceResultDisplay">Rzuć kością!</div>
                        )}
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
                otherPlayers={room.players.filter((p) => p.id !== playerId)}
                animalSymbols={animalSymbols}
            />
        </div>
    );
}

export default GameBoardSection;
