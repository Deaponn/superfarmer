import React, { useState } from "react";

function LoginSection({ onSetNick, initialNick }) {
    const [nick, setNick] = useState(initialNick || "");

    const handleSubmit = (e) => {
        e.preventDefault();
        if (nick.trim()) {
            onSetNick(nick.trim());
        } else {
            alert("Podaj nick!");
        }
    };

    return (
        <div id="loginSection">
            <h2>Witaj w Superfarmerze!</h2>
            <form onSubmit={handleSubmit}>
                <input
                    type="text"
                    id="nickInput"
                    placeholder="Podaj swój nick"
                    value={nick}
                    onChange={(e) => setNick(e.target.value)}
                />
                <button type="submit" id="setNickButton">
                    Ustaw Nick
                </button>
            </form>
        </div>
    );
}

export default LoginSection;
