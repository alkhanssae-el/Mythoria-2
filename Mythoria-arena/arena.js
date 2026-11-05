
import { addItem, loadItems, saveItems } from "./state.js";
import { generateId, formatDate } from "./utils.js";
import { renderList } from "./ui.js";

// SETTINGS
const MAX_HP = 3000;
const MAX_HAND = 5;
const SLOTS = 5;

const $ = id => document.getElementById(id);

// HTML ELEMENTS
const playerHand = $("player-hand");
const playerBoard = $("player-board");
const opponentBoard = $("opponent-board");
const combatLog = $("combat-log");

// CARD CATALOG
const catalog = [
    { name: "Solar Griffin", camp: "Light", rarity: "Rare", attack: 650, hp: 700 },
    { name: "Dawn Guardian", camp: "Light", rarity: "Common", attack: 400, hp: 650 },
    { name: "Celestial Knight", camp: "Light", rarity: "Epic", attack: 800, hp: 600 },
    { name: "Golden Phoenix", camp: "Light", rarity: "Legendary", attack: 950, hp: 850 },
    { name: "Moon Priestess", camp: "Light", rarity: "Rare", attack: 550, hp: 750 },
    { name: "Radiant Wolf", camp: "Light", rarity: "Common", attack: 450, hp: 500 },
    { name: "Shadow Wolf", camp: "Darkness", rarity: "Common", attack: 500, hp: 450 },
    { name: "Abyssal Demon", camp: "Darkness", rarity: "Rare", attack: 750, hp: 650 },
    { name: "Nightmare Dragon", camp: "Darkness", rarity: "Epic", attack: 900, hp: 700 },
    { name: "Void Reaper", camp: "Darkness", rarity: "Legendary", attack: 1000, hp: 800 },
    { name: "Cursed Sentinel", camp: "Darkness", rarity: "Rare", attack: 600, hp: 800 },
    { name: "Dark Phantom", camp: "Darkness", rarity: "Common", attack: 450, hp: 550 }
];

// GAME STATE
let player, opponent;
let firstPlayer = "";
let currentTurn = "";
let playerCamp = "";
let opponentCamp = "";
let turn = 1;

let selectedCard = null;
let selectedAttacker = null;

let playerSummoned = false;
let opponentSummoned = false;
let playerGuarded = false;

let busy = false;
let gameOver = false;
let aiTimer;

let history = loadItems();

// -------------------- DECK --------------------

function createDeck() {
    const cards = [];

    for (let i = 0; i < 2; i++) {
        catalog.forEach(card => {
            cards.push({ ...card, id: generateId() });
        });
    }

    return cards.sort(() => Math.random() - 0.5);
}

function createPlayer() {
    return {
        hp: MAX_HP,
        deck: createDeck(),
        hand: [],
        board: Array(SLOTS).fill(null)
    };
}

// -------------------- HISTORY --------------------

function log(message) {
    addItem(history, {
        id: generateId(),
        time: formatDate(),
        message
    });

    saveItems(history);
    renderList(combatLog, history);
}

// -------------------- COIN TOSS --------------------

function flipCoin() {
    if (firstPlayer) return;

    firstPlayer = Math.random() < 0.5 ? "player" : "opponent";

    $("coin-button").disabled = true;

    if (firstPlayer === "player") {
        $("setup-message").textContent = "You won! Choose your camp.";
        $("light-button").classList.remove("hidden");
        $("dark-button").classList.remove("hidden");
    } else {
        $("setup-message").textContent = "Your opponent won!";

        aiTimer = setTimeout(() => {
            chooseCamps(
                Math.random() < 0.5 ? "Light" : "Darkness",
                true
            );
        }, 1000);
    }
}

function chooseCamps(camp, aiChoice = false) {
    if (playerCamp) return;

    if (aiChoice) {
        opponentCamp = camp;
        playerCamp = camp === "Light" ? "Darkness" : "Light";
    } else {
        playerCamp = camp;
        opponentCamp = camp === "Light" ? "Darkness" : "Light";
    }

    startGame();
}

// -------------------- START GAME --------------------

function startGame() {
    player = createPlayer();
    opponent = createPlayer();

    for (let i = 0; i < MAX_HAND; i++) {
        player.hand.push(player.deck.pop());
        opponent.hand.push(opponent.deck.pop());
    }

    $("player-camp").textContent = playerCamp;
    $("opponent-camp").textContent = opponentCamp;

    $("setup-panel").classList.add("hidden");
    $("game-panel").classList.remove("hidden");

    history = [];
    saveItems(history);

    log("The battle has begun!");

    currentTurn = firstPlayer;

    if (currentTurn === "player") {
        startPlayerTurn();
    } else {
        startOpponentTurn();
    }
}

// -------------------- DRAWING --------------------

function drawCard(owner, side) {
    if (owner.hand.length >= MAX_HAND) return true;

    if (owner.deck.length === 0) {
        endGame(
            side === "player" ? "opponent" : "player",
            side === "player"
                ? "Your deck is empty."
                : "Your opponent's deck is empty."
        );

        return false;
    }

    owner.hand.push(owner.deck.pop());
    log(side === "player" ? "You drew a card." : "Opponent drew a card.");

    return true;
}

// -------------------- TURNS --------------------

function startPlayerTurn() {
    if (gameOver) return;

    currentTurn = "player";
    selectedCard = null;
    selectedAttacker = null;

    playerSummoned = false;
    playerGuarded = false;

    player.board.forEach(card => {
        if (card) {
            card.hasAttacked = false;
            card.isGuarding = false;
        }
    });

    log(`Turn ${turn}: Your turn.`);

    if (!drawCard(player, "player")) return;

    renderGame();
}

function startOpponentTurn() {
    if (gameOver) return;

    currentTurn = "opponent";

    opponentSummoned = false;

    opponent.board.forEach(card => {
        if (card) {
            card.hasAttacked = false;
            card.isGuarding = false;
        }
    });

    log("Opponent's turn.");

    if (!drawCard(opponent, "opponent")) return;

    renderGame();

    aiTimer = setTimeout(playAI, 800);
}

// -------------------- SUMMONING --------------------

function prepareCard(card, camp) {
    const multiplier = card.camp === camp ? 1 : 0.8;

    return {
        ...card,
        attackPoints: Math.floor(card.attack * multiplier),
        currentHp: Math.floor(card.hp * multiplier),
        hasAttacked: false,
        isGuarding: false
    };
}

function summonCard(slot) {
    if (gameOver || busy || currentTurn !== "player") return;

    if (playerSummoned) {
        notify("You can only summon one creature per turn.");
        return;
    }

    if (!selectedCard || player.board[slot]) return;

    const index = player.hand.findIndex(card => card.id === selectedCard);

    if (index === -1) return;

    const card = player.hand.splice(index, 1)[0];

    player.board[slot] = prepareCard(card, playerCamp);

    playerSummoned = true;
    selectedCard = null;

    log(`You summoned ${card.name}.`);
    renderGame();
}

function summonAI() {
    if (opponentSummoned || !opponent.hand.length) return;

    const slot = opponent.board.findIndex(card => card === null);

    if (slot === -1) return;

    const index = opponent.hand.reduce(
        (best, card, i, hand) =>
            card.attack > hand[best].attack ? i : best,
        0
    );

    const card = opponent.hand.splice(index, 1)[0];

    opponent.board[slot] = prepareCard(card, opponentCamp);
    opponentSummoned = true;

    log(`Opponent summoned ${card.name}.`);
}

// -------------------- ATTACKING --------------------

function selectAttacker(id) {
    if (gameOver || busy || currentTurn !== "player") return;

    const card = player.board.find(item => item?.id === id);

    if (!card || card.hasAttacked) return;

    selectedCard = null;
    selectedAttacker = id;

    $("battle-instruction").textContent =
        opponent.board.some(Boolean)
            ? "Choose an opponent creature."
            : "Choose direct attack or defend.";

    renderGame();
}

function selectHandCard(id) {
    if (gameOver || busy || currentTurn !== "player" || playerSummoned) return;

    selectedAttacker = null;
    selectedCard = selectedCard === id ? null : id;

    renderGame();
}

function creaturesRemain(board) {
    return board.some(Boolean);
}

async function damage(owner, target, amount) {
    if (busy || gameOver) return;

    busy = true;

    const finalDamage = target.isGuarding
        ? Math.ceil(amount * 0.5)
        : amount;

    target.currentHp -= finalDamage;

    log(`${target.name} received ${finalDamage} damage.`);

    renderGame();

    await wait(400);

    if (target.currentHp <= 0) {
        const index = owner.board.findIndex(card => card?.id === target.id);

        if (index !== -1) owner.board[index] = null;

        log(`${target.name} was destroyed.`);
    }

    busy = false;

    renderGame();
    checkGameEnd();
}

async function attackCreature(id) {
    if (gameOver || busy || currentTurn !== "player") return;

    const attacker = player.board.find(
        card => card?.id === selectedAttacker
    );

    if (!attacker || attacker.hasAttacked) return;

    const target = opponent.board.find(card => card?.isGuarding) ||
        opponent.board.find(card => card?.id === id);

    if (!target) return;

    attacker.hasAttacked = true;
    selectedAttacker = null;

    log(`${attacker.name} attacked ${target.name}.`);

    await damage(opponent, target, attacker.attackPoints);
}

async function directAttack() {
    if (gameOver || busy || currentTurn !== "player") return;

    const attacker = player.board.find(
        card => card?.id === selectedAttacker
    );

    if (!attacker || attacker.hasAttacked || creaturesRemain(opponent.board)) return;

    attacker.hasAttacked = true;
    selectedAttacker = null;

    opponent.hp = Math.max(0, opponent.hp - attacker.attackPoints);

    log(`${attacker.name} dealt ${attacker.attackPoints} direct damage.`);

    renderGame();
    checkGameEnd();
}

// -------------------- DEFENSE --------------------

function defend() {
    if (gameOver || busy || currentTurn !== "player" || playerGuarded) return;

    const card = player.board.find(
        item => item?.id === selectedAttacker
    );

    if (!card || card.hasAttacked) return;

    card.isGuarding = true;
    card.hasAttacked = true;

    playerGuarded = true;
    selectedAttacker = null;

    log(`${card.name} is defending and receives 50% less damage.`);

    renderGame();
}

// -------------------- AI --------------------

async function playAI() {
    if (gameOver) return;

    summonAI();
    renderGame();

    await wait(500);

    const attackers = opponent.board.filter(
        card => card && !card.hasAttacked
    );

    for (const attacker of attackers) {
        if (gameOver) return;

        attacker.hasAttacked = true;

        // AI can choose to defend.
        if (Math.random() < 0.2) {
            attacker.isGuarding = true;
            log(`${attacker.name} chose to defend.`);
            renderGame();
            continue;
        }

        const target = player.board.find(card => card?.isGuarding) ||
            player.board.filter(Boolean)
                .sort((a, b) => a.currentHp - b.currentHp)[0];

        if (target) {
            log(`${attacker.name} attacked ${target.name}.`);
            await damage(player, target, attacker.attackPoints);
        } else {
            player.hp = Math.max(0, player.hp - attacker.attackPoints);
            log(`${attacker.name} dealt ${attacker.attackPoints} direct damage.`);
            renderGame();
            checkGameEnd();
        }
    }

    if (gameOver) return;

    turn++;
    startPlayerTurn();
}

// -------------------- END TURN --------------------

function endTurn() {
    if (gameOver || busy || currentTurn !== "player") return;

    selectedCard = null;
    selectedAttacker = null;

    log("You ended your turn.");

    startOpponentTurn();
}

// -------------------- DISPLAY --------------------

function createCard(card, boardCard, ownerCamp) {
    const button = document.createElement("button");

    button.type = "button";
    button.className =
        "bg-[#211A29] border border-[#D4B66A]/70 rounded-md p-3 min-h-36 flex flex-col justify-between text-left";

    const camp = document.createElement("span");
    camp.className = "text-xs text-[#edd693]";
    camp.textContent = `${card.camp} · ${card.rarity}`;

    const name = document.createElement("strong");
    name.className = "text-sm text-white";
    name.textContent = card.name;

    const stats = document.createElement("span");
    stats.className = "text-xs text-[#D4B66A]";
    stats.textContent = boardCard
        ? `ATK: ${card.attackPoints} | HP: ${card.currentHp}`
        : `ATK: ${card.attack} | HP: ${card.hp}`;

    button.append(camp, name, stats);

    if (boardCard && card.camp !== ownerCamp) {
        const penalty = document.createElement("span");
        penalty.className = "text-xs text-red-300";
        penalty.textContent = "20% CAMP PENALTY";
        button.appendChild(penalty);
    }

    if (boardCard && card.isGuarding) {
        const guard = document.createElement("span");
        guard.className = "text-xs text-blue-300";
        guard.textContent = "GUARDING";
        button.appendChild(guard);
    }

    return button;
}

function renderBoard(container, board, side) {
    container.innerHTML = "";

    const ownerCamp = side === "player" ? playerCamp : opponentCamp;

    board.forEach((card, index) => {
        const slot = document.createElement("div");
        slot.className = "min-h-36";

        if (card) {
            const button = createCard(card, true, ownerCamp);

            if (side === "player") {
                if (selectedAttacker === card.id) {
                    button.classList.add("ring-2", "ring-yellow-300");
                }

                button.disabled =
                    currentTurn !== "player" || gameOver || busy || card.hasAttacked;

                button.addEventListener("click", () => selectAttacker(card.id));
            } else {
                button.disabled =
                    currentTurn !== "player" || gameOver || busy || !selectedAttacker;

                button.addEventListener("click", () => attackCreature(card.id));
            }

            slot.appendChild(button);
        } else {
            const button = document.createElement("button");

            button.type = "button";
            button.className =
                "w-full min-h-36 border-2 border-dashed border-[#D4B66A]/30 rounded-md text-xs text-gray-500";
            button.textContent = "EMPTY SLOT";

            button.disabled =
                side !== "player" ||
                currentTurn !== "player" ||
                gameOver ||
                busy ||
                !selectedCard ||
                playerSummoned;

            button.addEventListener("click", () => summonCard(index));

            slot.appendChild(button);
        }

        container.appendChild(slot);
    });
}

function renderHand() {
    playerHand.innerHTML = "";

    player.hand.forEach(card => {
        const button = createCard(card, false, playerCamp);

        if (selectedCard === card.id) {
            button.classList.add("ring-2", "ring-yellow-300");
        }

        button.disabled =
            currentTurn !== "player" ||
            gameOver ||
            busy ||
            playerSummoned;

        button.addEventListener("click", () => selectHandCard(card.id));

        playerHand.appendChild(button);
    });
}

function renderGame() {
    if (!player || !opponent) return;

    $("turn-number").textContent = turn;
    $("turn-owner").textContent = currentTurn === "player" ? "You" : "Opponent";

    $("player-hp").textContent = player.hp;
    $("opponent-hp").textContent = opponent.hp;

    $("player-hp-bar").style.width = `${player.hp / MAX_HP * 100}%`;
    $("opponent-hp-bar").style.width = `${opponent.hp / MAX_HP * 100}%`;

    $("deck-count").textContent = player.deck.length;
    $("hand-count").textContent = player.hand.length;

    renderBoard(playerBoard, player.board, "player");
    renderBoard(opponentBoard, opponent.board, "opponent");
    renderHand();

    $("end-turn-button").disabled =
        currentTurn !== "player" || gameOver || busy;

    $("guard-button").disabled =
        currentTurn !== "player" ||
        gameOver ||
        busy ||
        !selectedAttacker ||
        playerGuarded;

    $("direct-attack-button").classList.toggle(
        "hidden",
        !selectedAttacker || creaturesRemain(opponent.board)
    );

    $("direct-attack-button").disabled =
        currentTurn !== "player" || gameOver || busy;
}

// -------------------- GAME END --------------------

function checkGameEnd() {
    if (gameOver) return true;

    if (player.hp <= 0) {
        endGame("opponent", "Your HP reached zero.");
        return true;
    }

    if (opponent.hp <= 0) {
        endGame("player", "Your opponent's HP reached zero.");
        return true;
    }

    return false;
}

function endGame(winner, reason) {
    if (gameOver) return;

    gameOver = true;
    clearTimeout(aiTimer);

    $("result-title").textContent =
        winner === "player" ? "VICTORY!" : "DEFEAT!";

    $("result-message").textContent = reason;
    $("result-panel").classList.remove("hidden");

    log(winner === "player" ? "You won the battle!" : "You lost the battle!");

    renderGame();
}

// -------------------- HELPERS --------------------

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function notify(message) {
    const box = $("message-box");

    box.textContent = message;
    box.classList.remove("hidden");

    clearTimeout(window.notificationTimer);

    window.notificationTimer = setTimeout(() => {
        box.classList.add("hidden");
    }, 2500);
}

function restartGame() {
    clearTimeout(aiTimer);
    window.location.reload();
}

// -------------------- EVENTS --------------------

$("coin-button").addEventListener("click", flipCoin);

$("light-button").addEventListener("click", () => {
    chooseCamps("Light");
});

$("dark-button").addEventListener("click", () => {
    chooseCamps("Darkness");
});

$("end-turn-button").addEventListener("click", endTurn);
$("guard-button").addEventListener("click", defend);
$("direct-attack-button").addEventListener("click", directAttack);
$("restart-button").addEventListener("click", restartGame);

renderList(combatLog, history);
