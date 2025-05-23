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
        currentPlayerId: room.players[0].id,
        diceResult: null,
        log: [],
        playerTurnState: room.players.reduce((acc, p) => {
            acc[p.id] = { hasExchanged: false, hasRolled: false };
            return acc;
        }, {}),
        pendingTrades: {}, // { "tradeId1": { tradeId, proposingPlayerId, targetPlayerId, offeredItems, requestedItems, timestamp }, ... }
    };
    room.players.forEach((player) => {
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

    const diceOutcomes = [die1, die2];
    let gainedAnimals = {};

    for (const outcome of diceOutcomes) {
        if (outcome === "wolf" || outcome === "fox") continue;

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
            if (
                (outcome === "horse" && player.animals.horse === 0 && player.animals.cow === 0) ||
                (outcome === "cow" && player.animals.cow === 0 && !player.animals.pig > 0)
            ) {
                if (diceOutcomes.includes(outcome) && player.animals[outcome] === 0) {
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
        logMessages.push(`${player.nick} nie rozmnożył żadnych zwierząt w tej turze.`);
    }

    room.gameState.playerTurnState[playerId].hasRolled = true;
    room.gameState.log.push(...logMessages);
    return { diceResult: room.gameState.diceResult, logMessages };
}

function generateTradeId() {
    return `trade_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function playerHasAnimals(player, items) {
    if (!player || !player.animals || !items) return false;
    for (const animal in items) {
        if ((player.animals[animal] || 0) < items[animal]) {
            return false;
        }
    }
    return true;
}

function transferAnimals(fromPlayer, toPlayer, items) {
    if (!fromPlayer || !toPlayer || !items) return;
    for (const animal in items) {
        const amount = items[animal];
        fromPlayer.animals[animal] = (fromPlayer.animals[animal] || 0) - amount;
        toPlayer.animals[animal] = (toPlayer.animals[animal] || 0) + amount;
    }
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
    const activePlayers = room.players.filter((p) => p.socketId);
    if (activePlayers.length === 0) return null;

    let currentIndex = activePlayers.findIndex((p) => p.id === currentPlayerId);
    if (currentIndex === -1 && activePlayers.length > 0) return activePlayers[0].id;

    let nextIndex = skipCurrent ? currentIndex : (currentIndex + 1) % activePlayers.length;
    const nextPlayerId = activePlayers[nextIndex].id;

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
    generateTradeId,
    playerHasAnimals,
    transferAnimals,
    handleExchangeWithBank,
    checkWinCondition,
    determineNextPlayer,
    animalSymbols,
    initialMainHerd,
    dice1Definition,
    dice2Definition,
    tradeRules,
};
