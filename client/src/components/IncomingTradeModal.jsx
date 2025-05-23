import React from "react";
// import { animalSymbols as appAnimalSymbols } from '../constants'; // Przekazane jako prop

function IncomingTradeModal({ tradeOffer, onRespond, animalSymbols }) {
    if (!tradeOffer) return null;

    const { tradeId, fromPlayerNick, offeredItems, requestedItems } = tradeOffer;

    const formatItems = (items) => {
        if (!items || Object.keys(items).length === 0) return "nic";
        return Object.entries(items)
            .map(([animal, count]) => `${count} ${animalSymbols[animal] || animal}`)
            .join(", ");
    };

    return (
        <div className="modal incoming-trade-modal" style={{ display: "block", zIndex: 1050 }}>
            {" "}
            {/* Wyższy z-index */}
            <div className="modal-content">
                <h4>Oferta Wymiany od: {fromPlayerNick}</h4>
                <p>
                    <strong>{fromPlayerNick} oferuje Ci:</strong> {formatItems(offeredItems)}
                </p>
                <p>
                    <strong>{fromPlayerNick} prosi od Ciebie:</strong> {formatItems(requestedItems)}
                </p>
                <div style={{ marginTop: "20px" }}>
                    <button
                        onClick={() => onRespond(tradeId, true)}
                        style={{ marginRight: "10px", backgroundColor: "green", color: "white" }}
                    >
                        Akceptuj
                    </button>
                    <button
                        onClick={() => onRespond(tradeId, false)}
                        style={{ backgroundColor: "red", color: "white" }}
                    >
                        Odrzuć
                    </button>
                </div>
            </div>
        </div>
    );
}

export default IncomingTradeModal;
