import React, { useState, useEffect } from "react";
import { allAnimalTypes, animalSymbols as appAnimalSymbols, tradeRulesClient } from "../constants";

function ExchangeModal({ isOpen, onClose, onConfirmExchange, playerAnimals, bankAnimals }) {
    const [fromAnimal, setFromAnimal] = useState(allAnimalTypes[0]);
    const [fromAmount, setFromAmount] = useState(1);
    const [toAnimal, setToAnimal] = useState(allAnimalTypes[1] || allAnimalTypes[0]);
    const [possibleToAnimals, setPossibleToAnimals] = useState([]);
    const [calculatedToAmount, setCalculatedToAmount] = useState(0);

    const animalSymbols = appAnimalSymbols;

    useEffect(() => {
        if (isOpen) {
            setFromAnimal(allAnimalTypes[0]);
            setFromAmount(1);
            const relevantRules = tradeRulesClient.filter(
                (rule) => rule.from === allAnimalTypes[0]
            );
            setPossibleToAnimals(relevantRules.map((rule) => rule.to));
            if (relevantRules.length > 0) {
                setToAnimal(relevantRules[0].to);
            } else {
                setToAnimal(allAnimalTypes[1] || allAnimalTypes[0]);
            }
        }
    }, [isOpen]);

    useEffect(() => {
        const relevantRules = tradeRulesClient.filter((rule) => rule.from === fromAnimal);
        setPossibleToAnimals(relevantRules.map((rule) => rule.to));
        if (relevantRules.length > 0 && !relevantRules.find((r) => r.to === toAnimal)) {
            setToAnimal(relevantRules[0].to);
        } else if (relevantRules.length === 0) {
            setToAnimal("");
        }
    }, [fromAnimal, toAnimal]);

    useEffect(() => {
        const rule = tradeRulesClient.find((r) => r.from === fromAnimal && r.to === toAnimal);
        if (
            rule &&
            Number(fromAmount) >= rule.fromCount &&
            Number(fromAmount) % rule.fromCount === 0
        ) {
            const units = Number(fromAmount) / rule.fromCount;
            setCalculatedToAmount(units * rule.toCount);
        } else {
            setCalculatedToAmount(0);
        }
    }, [fromAnimal, toAnimal, fromAmount]);

    if (!isOpen) return null;

    const handleSubmit = () => {
        if (calculatedToAmount <= 0) {
            alert("Nieprawidłowa ilość do wymiany lub brak takiej reguły.");
            return;
        }
        if (playerAnimals && playerAnimals[fromAnimal] < Number(fromAmount)) {
            alert(`Nie masz wystarczająco ${animalSymbols[fromAnimal] || fromAnimal}.`);
            return;
        }
        if (bankAnimals && bankAnimals[toAnimal] < calculatedToAmount) {
            alert(`Bank nie ma wystarczająco ${animalSymbols[toAnimal] || toAnimal}.`);
            return;
        }
        onConfirmExchange({ fromAnimal, fromAmount: Number(fromAmount), toAnimal });
        onClose();
    };

    return (
        <div id="exchangeModal" className="modal" style={{ display: "block" }}>
            <div className="modal-content">
                <span className="close-button" onClick={onClose}>
                    &times;
                </span>
                <h4>Wymiana z Bankiem</h4>
                <div>
                    <label>Oddajesz:</label>
                    <select
                        id="exchangeFromAnimal"
                        value={fromAnimal}
                        onChange={(e) => setFromAnimal(e.target.value)}
                    >
                        {allAnimalTypes.map((animal) => (
                            <option key={animal} value={animal}>
                                {animalSymbols[animal] || animal}
                            </option>
                        ))}
                    </select>
                    <input
                        type="number"
                        id="exchangeFromAmount"
                        min="1"
                        value={fromAmount}
                        onChange={(e) => setFromAmount(Math.max(1, parseInt(e.target.value) || 1))}
                    />
                </div>
                <div>
                    <label>Otrzymujesz:</label>
                    <select
                        id="exchangeToAnimal"
                        value={toAnimal}
                        onChange={(e) => setToAnimal(e.target.value)}
                        disabled={possibleToAnimals.length === 0}
                    >
                        {possibleToAnimals.length > 0 ? (
                            possibleToAnimals.map((animal) => (
                                <option key={animal} value={animal}>
                                    {animalSymbols[animal] || animal}
                                </option>
                            ))
                        ) : (
                            <option value="">Brak możliwych wymian</option>
                        )}
                    </select>
                    <span>
                        {" "}
                        (Otrzymasz: {calculatedToAmount} {animalSymbols[toAnimal] || toAnimal})
                    </span>
                </div>
                <button
                    id="confirmExchangeButton"
                    onClick={handleSubmit}
                    disabled={calculatedToAmount <= 0}
                >
                    Wymień
                </button>
            </div>
        </div>
    );
}
export default ExchangeModal;
