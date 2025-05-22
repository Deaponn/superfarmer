export const animalSymbols = {
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

export const allAnimalTypes = ["rabbit", "sheep", "pig", "cow", "horse", "smallDog", "bigDog"];

// Możesz tu też przenieść definicje kostek i zasad wymiany, jeśli klient ich potrzebuje
// np. do walidacji po stronie klienta przed wysłaniem do serwera
export const tradeRulesClient = [
    // Uproszczone, dla selectów w modalu
    // Zasady wymiany z bankiem
    { from: "rabbit", to: "sheep", fromCount: 6, toCount: 1 },
    { from: "sheep", to: "rabbit", fromCount: 1, toCount: 6 },
    { from: "sheep", to: "pig", fromCount: 2, toCount: 1 },
    { from: "pig", to: "sheep", fromCount: 1, toCount: 2 },
    { from: "pig", to: "cow", fromCount: 3, toCount: 1 },
    { from: "cow", to: "pig", fromCount: 1, toCount: 3 },
    { from: "cow", to: "horse", fromCount: 2, toCount: 1 },
    { from: "horse", to: "cow", fromCount: 1, toCount: 2 },
    { from: "sheep", to: "smallDog", fromCount: 1, toCount: 1 },
    // { from: 'smallDog', to: 'sheep', fromCount: 1, toCount: 1 }, // Zazwyczaj nie sprzedaje się psów
    { from: "cow", to: "bigDog", fromCount: 1, toCount: 1 },
    // { from: 'bigDog', to: 'cow', fromCount: 1, toCount: 1 },
];
