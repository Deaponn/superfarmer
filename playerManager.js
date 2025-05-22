const { v4: uuidv4 } = require('uuid');

const playerMap = {};

function addPlayer(nick) {
    const playerId = uuidv4();
    playerMap[playerId] = {
        nick,
        room: null
    }
    return playerId;
}

function getPlayer(playerId) {
    return playerMap[playerId];
}

module.exports = {
    addPlayer,
    getPlayer
};
