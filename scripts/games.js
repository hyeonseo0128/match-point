const games = [];

function addGame(date, time, location) {
    const game = {
        id: games.length + 1,
        date: date,
        time: time,
        location: location,
    };
    games.push(game);
    displayGames();
}

function displayGames() {
    const gamesList = document.getElementById('games-list');
    gamesList.innerHTML = '';

    games.forEach(game => {
        const listItem = document.createElement('li');
        listItem.textContent = `${game.date} - ${game.time} at ${game.location}`;
        gamesList.appendChild(listItem);
    });
}

document.getElementById('add-game-form').addEventListener('submit', function(event) {
    event.preventDefault();
    const date = event.target.date.value;
    const time = event.target.time.value;
    const location = event.target.location.value;

    addGame(date, time, location);
    event.target.reset();
});