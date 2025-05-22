const animalSymbols = {
    rabbit: "🐇",
    sheep: "🐑",
    pig: "🐖",
    cow: "🐄",
    horse: "🐎",
    smallDog: "🐕",
    bigDog: "🐩",
    wolf: "🐺",
    fox: "🦊",
};
const initialMainHerd = {
    rabbit: 60,
    sheep: 24,
    pig: 20,
    cow: 12,
    horse: 6,
    smallDog: 4,
    bigDog: 2,
};
const dice1Definition = [
    "rabbit",
    "rabbit",
    "rabbit",
    "rabbit",
    "rabbit",
    "rabbit",
    "sheep",
    "sheep",
    "sheep",
    "pig",
    "cow",
    "wolf",
];
const dice2Definition = [
    "sheep",
    "sheep",
    "sheep",
    "sheep",
    "sheep",
    "sheep",
    "sheep",
    "sheep",
    "pig",
    "pig",
    "horse",
    "fox",
];
const tradeRules = [
    { from: "rabbit", count: 6, to: "sheep", toCount: 1 },
    { from: "sheep", count: 1, to: "rabbit", toCount: 6 },
    { from: "sheep", count: 2, to: "pig", toCount: 1 },
    { from: "pig", count: 1, to: "sheep", toCount: 2 },
    { from: "pig", count: 3, to: "cow", toCount: 1 },
    { from: "cow", count: 1, to: "pig", toCount: 3 },
    { from: "cow", count: 2, to: "horse", toCount: 1 },
    { from: "horse", count: 1, to: "cow", toCount: 2 },
    { from: "sheep", count: 1, to: "smallDog", toCount: 1 },
    { from: "smallDog", count: 1, to: "sheep", toCount: 1 },
    { from: "cow", count: 1, to: "bigDog", toCount: 1 },
    { from: "bigDog", count: 1, to: "cow", toCount: 1 },
];

function initializeGame(room) {
    if (!room || room.players.length < 2)
        throw new Error("Nie można rozpocząć gry: za mało graczy.");
    room.gameStarted = true;
    room.gameState = {
        mainHerd: { ...initialMainHerd },
        currentPlayerId: room.players[0].id, // Zaczyna pierwszy gracz z listy
        diceResult: null,
        log: [],
        playerTurnState: room.players.reduce((acc, p) => {
            // Stan dla każdego gracza w turze
            acc[p.id] = { hasExchanged: false, hasRolled: false };
            return acc;
        }, {}),
    };
    room.players.forEach((player) => {
        // Rozdaj początkowe króliki
        if (room.gameState.mainHerd.rabbit > 0) {
            player.animals.rabbit = 1;
            room.gameState.mainHerd.rabbit--;
        }
    });
    console.log(
        `Gra rozpoczęta w pokoju ${room.name}. Zaczyna gracz: ${room.gameState.currentPlayerId}`
    );
}

function rollSingleDie(dieDefinition) {
    return dieDefinition[Math.floor(Math.random() * dieDefinition.length)];
}

function handleRollDice(room, playerId) {
    const player = room.players.find((p) => p.id === playerId);
    if (!player) throw new Error("Gracz nie znaleziony.");

    const die1 = rollSingleDie(dice1Definition);
    const die2 = rollSingleDie(dice2Definition);
    room.gameState.diceResult = { die1, die2 };
    let logMessages = [
        `${player.nick} wyrzucił: ${animalSymbols[die1] || die1} i ${animalSymbols[die2] || die2}.`,
    ];

    let smallDogUsed = false;
    let bigDogUsed = false;

    // Atak lisa
    if (die1 === "fox" || die2 === "fox") {
        if (player.animals.smallDog > 0) {
            player.animals.smallDog--;
            room.gameState.mainHerd.smallDog++;
            smallDogUsed = true;
            logMessages.push(
                `${player.nick} używa małego psa ${animalSymbols.smallDog}, aby odgonić lisa! Pies wraca do stada.`
            );
        } else {
            const rabbitsLost = player.animals.rabbit > 1 ? player.animals.rabbit - 1 : 0;
            if (rabbitsLost > 0) {
                player.animals.rabbit = 1;
                room.gameState.mainHerd.rabbit += rabbitsLost;
                logMessages.push(
                    `Lis ${animalSymbols.fox} atakuje! ${player.nick} traci ${rabbitsLost} królików ${animalSymbols.rabbit}. Zostaje 1 królik.`
                );
            } else {
                logMessages.push(
                    `Lis ${animalSymbols.fox} atakuje, ale ${player.nick} ${
                        player.animals.rabbit === 1
                            ? "ma tylko 1 bezpiecznego królika."
                            : "nie ma królików."
                    }`
                );
            }
        }
    }

    // Atak wilka
    if (die1 === "wolf" || die2 === "wolf") {
        if (player.animals.bigDog > 0) {
            player.animals.bigDog--;
            room.gameState.mainHerd.bigDog++;
            bigDogUsed = true;
            logMessages.push(
                `${player.nick} używa dużego psa ${animalSymbols.bigDog}, aby odgonić wilka! Pies wraca do stada.`
            );
        } else {
            let animalsLostToWolf = {};
            ["sheep", "pig", "cow"].forEach((type) => {
                // Wilk nie rusza koni, królików, małych psów
                if (player.animals[type] > 0) {
                    animalsLostToWolf[type] = player.animals[type];
                    room.gameState.mainHerd[type] += player.animals[type];
                    player.animals[type] = 0;
                }
            });
            if (Object.keys(animalsLostToWolf).length > 0) {
                logMessages.push(
                    `Wilk ${animalSymbols.wolf} atakuje! ${player.nick} traci: ${Object.entries(
                        animalsLostToWolf
                    )
                        .map(([a, c]) => `${c} ${animalSymbols[a]}`)
                        .join(", ")}.`
                );
            } else {
                logMessages.push(
                    `Wilk ${animalSymbols.wolf} atakuje, ale ${player.nick} nie ma zwierząt podatnych na atak (lub są chronione).`
                );
            }
        }
    }

    // Rozmnażanie (tylko jeśli nie było skutecznego ataku drapieżnika LUB drapieżnik był na tej samej kostce co zwierzę do rozmnożenia i został obroniony)
    const diceOutcomes = [die1, die2];
    let gainedAnimals = {};

    for (const outcome of diceOutcomes) {
        if (outcome === "wolf" || outcome === "fox") continue; // Drapieżniki nie rozmnażają

        // Sprawdzenie, czy atak na tej kostce został odparty (jeśli był drapieżnik)
        // Ta logika jest uproszczona; jeśli wilk był na die1, a królik na die2, królik może się rozmnożyć
        // Ważne jest, czy drapieżnik zaatakował *jakiekolwiek* zwierzęta. Jeśli tak, rozmnażanie z tej kostki jest anulowane
        // chyba że pies obronił.
        // Uproszczenie: jeśli był lis i nie było małego psa, pomiń rozmnażanie królików.
        // Jeśli był wilk i nie było dużego psa, pomiń rozmnażanie podatnych zwierząt.

        let canBreedThisAnimal = true;
        if (outcome === "rabbit" && (die1 === "fox" || die2 === "fox") && !smallDogUsed)
            canBreedThisAnimal = false;
        if (
            ["sheep", "pig", "cow"].includes(outcome) &&
            (die1 === "wolf" || die2 === "wolf") &&
            !bigDogUsed
        )
            canBreedThisAnimal = false;

        if (canBreedThisAnimal) {
            // Ograniczenie zdobycia pierwszego konia/krowy
            if (
                (outcome === "horse" && player.animals.horse === 0 && player.animals.cow === 0) || // Potrzebujesz krowy by wymienić na konia, więc nie dostaniesz z rzutu bez posiadania krów. Uproszczenie: pierwszy koń/krowa tylko z wymiany.
                (outcome === "cow" && player.animals.cow === 0 && !player.animals.pig > 0)
            ) {
                // podobnie dla krowy
                if (diceOutcomes.includes(outcome) && player.animals[outcome] === 0) {
                    // Tylko jeśli faktycznie wylosował i nie ma
                    logMessages.push(
                        `${player.nick} nie może otrzymać ${animalSymbols[outcome]} z rzutu, bo nie posiada jeszcze tego zwierzęcia. Pierwsze musi być z wymiany.`
                    );
                    continue;
                }
            }

            const totalPlayerAnimals =
                player.animals[outcome] + diceOutcomes.filter((d) => d === outcome).length;
            const pairs = Math.floor(totalPlayerAnimals / 2);

            if (pairs > 0) {
                const amountToGain = Math.min(pairs, room.gameState.mainHerd[outcome] || 0);
                if (amountToGain > 0) {
                    player.animals[outcome] += amountToGain;
                    room.gameState.mainHerd[outcome] -= amountToGain;
                    gainedAnimals[outcome] = (gainedAnimals[outcome] || 0) + amountToGain;
                } else if (pairs > 0 && (room.gameState.mainHerd[outcome] || 0) === 0) {
                    logMessages.push(
                        `Niestety, w stadzie głównym zabrakło ${animalSymbols[outcome]}.`
                    );
                }
            }
        }
    }
    if (Object.keys(gainedAnimals).length > 0) {
        logMessages.push(
            `${player.nick} otrzymuje: ${Object.entries(gainedAnimals)
                .map(([a, c]) => `${c} ${animalSymbols[a]}`)
                .join(", ")}.`
        );
    } else if (
        diceOutcomes.every((d) => d !== "fox" && d !== "wolf") &&
        diceOutcomes.some((d) => ["rabbit", "sheep", "pig", "cow", "horse"].includes(d))
    ) {
        // Jeśli na kostkach były zwierzęta, ale nic nie przybyło (np. brak par, brak w stadzie)
        logMessages.push(`${player.nick} nie rozmnożył żadnych zwierząt w tej turze.`);
    }

    room.gameState.playerTurnState[playerId].hasRolled = true;
    room.gameState.log.push(...logMessages);
    return { diceResult: room.gameState.diceResult, logMessages };
}

function handleExchangeWithBank(room, playerId, fromAnimal, fromAmountStr, toAnimal) {
    const player = room.players.find((p) => p.id === playerId);
    if (!player) throw new Error("Gracz nie znaleziony.");
    const fromAmount = parseInt(fromAmountStr);
    if (isNaN(fromAmount) || fromAmount <= 0) throw new Error("Nieprawidłowa ilość do wymiany.");

    const rule = tradeRules.find((r) => r.from === fromAnimal && r.to === toAnimal);
    if (!rule) throw new Error(`Nie można wymienić ${fromAnimal} na ${toAnimal} z bankiem.`);

    const numTradeUnits = fromAmount / rule.count;
    if (!Number.isInteger(numTradeUnits) || numTradeUnits < 1) {
        throw new Error(
            `Możesz wymieniać tylko wielokrotności ${rule.count} ${animalSymbols[fromAnimal]}.`
        );
    }
    const totalToReceive = numTradeUnits * rule.toCount;

    if (player.animals[fromAnimal] < fromAmount) {
        throw new Error(
            `Nie masz wystarczająco ${animalSymbols[fromAnimal]} (masz ${player.animals[fromAnimal]}, potrzebujesz ${fromAmount}).`
        );
    }
    if ((room.gameState.mainHerd[toAnimal] || 0) < totalToReceive) {
        throw new Error(
            `Bank nie ma wystarczająco ${animalSymbols[toAnimal]} (bank ma ${
                room.gameState.mainHerd[toAnimal] || 0
            }, chcesz ${totalToReceive}).`
        );
    }

    player.animals[fromAnimal] -= fromAmount;
    room.gameState.mainHerd[fromAnimal] = (room.gameState.mainHerd[fromAnimal] || 0) + fromAmount;
    player.animals[toAnimal] = (player.animals[toAnimal] || 0) + totalToReceive;
    room.gameState.mainHerd[toAnimal] -= totalToReceive;

    const log = `${player.nick} wymienił ${fromAmount} ${animalSymbols[fromAnimal]} na ${totalToReceive} ${animalSymbols[toAnimal]} z bankiem.`;
    room.gameState.log.push(log);
    room.gameState.playerTurnState[playerId].hasExchanged = true;
    return { success: true, log };
}

function checkWinCondition(player) {
    if (!player || !player.animals) return false;
    return (
        player.animals.rabbit >= 1 &&
        player.animals.sheep >= 1 &&
        player.animals.pig >= 1 &&
        player.animals.cow >= 1 &&
        player.animals.horse >= 1
    );
}

function determineNextPlayer(room, currentPlayerId, skipCurrent = false) {
    const activePlayers = room.players.filter((p) => p.socketId); // Tylko aktywni gracze
    if (activePlayers.length === 0) return null;

    let currentIndex = activePlayers.findIndex((p) => p.id === currentPlayerId);
    if (currentIndex === -1 && activePlayers.length > 0) return activePlayers[0].id; // Jeśli obecny gracz nieaktywny, weź pierwszego aktywnego

    let nextIndex = skipCurrent ? currentIndex : (currentIndex + 1) % activePlayers.length;
    const nextPlayerId = activePlayers[nextIndex].id;

    // Reset stanu tury dla nowego gracza
    if (
        room.gameState &&
        room.gameState.playerTurnState &&
        room.gameState.playerTurnState[nextPlayerId]
    ) {
        room.gameState.playerTurnState[nextPlayerId] = { hasExchanged: false, hasRolled: false };
    }
    return nextPlayerId;
}

module.exports = {
    initializeGame,
    handleRollDice,
    handleExchangeWithBank,
    checkWinCondition,
    determineNextPlayer,
    animalSymbols,
    initialMainHerd,
    dice1Definition,
    dice2Definition,
    tradeRules,
};
