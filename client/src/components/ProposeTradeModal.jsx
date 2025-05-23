import React, { useState, useEffect } from "react";
import { allAnimalTypes, animalSymbols as appAnimalSymbols } from "../constants";

function ProposeTradeModal({
    isOpen,
    onClose,
    onConfirmPropose,
    myAnimals,
    otherPlayers,
    animalSymbols,
}) {
    const [targetPlayerId, setTargetPlayerId] = useState("");
    const [offeredItems, setOfferedItems] = useState({}); // { rabbit: 1, sheep: 0, ... }
    const [requestedItems, setRequestedItems] = useState({});

    useEffect(() => {
        if (isOpen && otherPlayers.length > 0) {
            setTargetPlayerId(otherPlayers[0].id); // Ustaw domyślnie pierwszego gracza
        }
        if (!isOpen) {
            // Resetuj stan po zamknięciu
            setOfferedItems({});
            setRequestedItems({});
            setTargetPlayerId("");
        }
    }, [isOpen, otherPlayers]);

    const handleItemChange = (itemType, animal, value, isOffered) => {
        const currentAmount = Number(value) || 0;
        const maxAmount = isOffered ? myAnimals[animal] || 0 : Infinity; // Teoretycznie nieskończoność dla żądanych

        const newAmount = Math.min(Math.max(0, currentAmount), maxAmount);

        if (isOffered) {
            setOfferedItems((prev) => ({ ...prev, [animal]: newAmount }));
        } else {
            setRequestedItems((prev) => ({ ...prev, [animal]: newAmount }));
        }
    };

    const handleSubmit = () => {
        const finalOffered = Object.fromEntries(
            Object.entries(offeredItems).filter(([_, val]) => val > 0)
        );
        const finalRequested = Object.fromEntries(
            Object.entries(requestedItems).filter(([_, val]) => val > 0)
        );

        if (Object.keys(finalOffered).length === 0 && Object.keys(finalRequested).length === 0) {
            alert("Musisz zaoferować lub poprosić o przynajmniej jedno zwierzę.");
            return;
        }
        if (!targetPlayerId) {
            alert("Wybierz gracza do wymiany.");
            return;
        }

        onConfirmPropose({
            targetPlayerId,
            offeredItems: finalOffered,
            requestedItems: finalRequested,
        });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="modal" style={{ display: "block" }}>
            <div className="modal-content" style={{ minWidth: "400px" }}>
                <span className="close-button" onClick={onClose}>
                    &times;
                </span>
                <h4>Zaproponuj Wymianę Graczowi</h4>

                <div>
                    <label htmlFor="targetPlayerSelect">Wymień z:</label>
                    <select
                        id="targetPlayerSelect"
                        value={targetPlayerId}
                        onChange={(e) => setTargetPlayerId(e.target.value)}
                        disabled={otherPlayers.length === 0}
                    >
                        {otherPlayers.length === 0 && <option value="">Brak innych graczy</option>}
                        {otherPlayers.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.nick}
                            </option>
                        ))}
                    </select>
                </div>

                <div style={{ display: "flex", justifyContent: "space-around", marginTop: "15px" }}>
                    <div>
                        <h5>
                            Oferujesz (Twoje:{" "}
                            {myAnimals ? Object.values(myAnimals).reduce((a, b) => a + b, 0) : 0}):
                        </h5>
                        {allAnimalTypes.map((animal) => (
                            <div key={`offer-${animal}`} style={{ marginBottom: "5px" }}>
                                <label>
                                    {animalSymbols[animal] || animal} (Masz:{" "}
                                    {myAnimals[animal] || 0}):{" "}
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    max={myAnimals[animal] || 0}
                                    value={offeredItems[animal] || 0}
                                    onChange={(e) =>
                                        handleItemChange("offer", animal, e.target.value, true)
                                    }
                                    style={{ width: "60px" }}
                                />
                            </div>
                        ))}
                    </div>
                    <div>
                        <h5>Żądasz:</h5>
                        {allAnimalTypes.map((animal) => (
                            <div key={`request-${animal}`} style={{ marginBottom: "5px" }}>
                                <label>{animalSymbols[animal] || animal}: </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={requestedItems[animal] || 0}
                                    onChange={(e) =>
                                        handleItemChange("request", animal, e.target.value, false)
                                    }
                                    style={{ width: "60px" }}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <button
                    onClick={handleSubmit}
                    style={{ marginTop: "20px" }}
                    disabled={otherPlayers.length === 0}
                >
                    Zaproponuj Wymianę
                </button>
            </div>
        </div>
    );
}

export default ProposeTradeModal;
