import io from "socket.io-client";

// Adres URL twojego serwera Socket.IO
// Jeśli serwer jest na tym samym hoście i porcie co aplikacja kliencka,
// możesz pominąć URL, a Socket.IO spróbuje połączyć się automatycznie.
// const SERVER_URL = 'http://localhost:3000'; // Przykładowy URL, jeśli serwer jest na innym porcie/hoście
// export const socket = io(SERVER_URL);

export const socket = io(); // Zakładając, że serwer jest na tym samym hoście
