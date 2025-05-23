import React from "react";

function AnimalDisplay({ animals, animalSymbols, title }) {
    return (
        <div>
            {title && <h4>{title}</h4>}
            {Object.entries(animals).map(([animal, count]) => (
                <span key={animal} style={{ display: "block" }}>
                    {animalSymbols[animal] || animal}: {count}
                </span>
            ))}
        </div>
    );
}

export default AnimalDisplay;
