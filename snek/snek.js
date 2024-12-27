const isThatGlock = 64;
const rows = 15;
const columns = 20;

let snekX = isThatGlock * 5
let snekY = isThatGlock * 5
let foodX;
let foodY;

let speedX = 0;
let speedY = 0;

let bod = [];

let board;
let context;

let snake = new Image();
let food = new Image();
let bro = new Image();
let bite = new Audio();
let hit = new Audio();
let soz = new Image();
let bp = new Image();

let score = 0;
let record = 10000;
let recorder = "Chen";
let over = false;

bro.src = "image-right.webp";
food.src = "image (1).webp";
snake.src = "image (2)-right.webp";
bite.src = "nom.mp3";
hit.src = "ough-47202.mp3";
soz.src = "image (3)-right.webp";
bp.src = "h.png"

let difficulty = 150.5;

window.onload = () => {
    // initialise the canvas
    board = document.getElementById("gaem");
    board.height = rows * isThatGlock;
    board.width = columns * isThatGlock;
    context = board.getContext("2d");

    // place the food and the snake
    let placement = placeFood();
    while (placement) {
        placement = placeFood();
    }
    placement = initialiseSnek();
    while (placement) {
        placement = initialiseSnek();
    }

    // move the snake every few milliseconds, which decreases as the score goes up. listen for any keys
    setInterval(update, difficulty);
    document.addEventListener("keydown", move);
}

const update = () => {
    if (over) {
        return;
    }

    // gameboard
    const p = context.createPattern(bp, null)
    context.fillStyle = p;
    context.fillRect(0, 0, board.width, board.height);

    snekX += speedX * isThatGlock;
    snekY += speedY * isThatGlock;

    // when snake eats food
    if (snekX === foodX && snekY === foodY) {
        bite.play();
        difficulty += -0.5
        score++;
        bod.push([foodX, foodY]);
        placeFood();
    }

    // store the coordinates of the snake body in an array
    for (let i = bod.length - 1; i > 0; i--) {
        bod[i] = bod[i - 1];
    }

    // draw the snake's body
    for (let i = 0; i < bod.length; i++) {
        if (!i) {
            continue;
        }
        else if (i === bod.length - 1) {
            const end = context.createPattern(soz, null)
            context.fillStyle = end;
            context.fillRect(bod[i][0], bod[i][1], isThatGlock, isThatGlock);
        }
        else {
            const middle = context.createPattern(bro, null)
            context.fillStyle = middle;
            context.fillRect(bod[i][0], bod[i][1], isThatGlock, isThatGlock);
        }
    }

    // draw the snake's head
    const snak = context.createPattern(snake, null)
    context.fillStyle = snak;
    context.fillRect(snekX, snekY, isThatGlock, isThatGlock);

    // draw the food
    const fod = context.createPattern(food, null)
    context.fillStyle = fod;
    context.fillRect(foodX, foodY, isThatGlock, isThatGlock);
    
    // game over criteria

    // if the snake hits the perimeter of the canvas
    if (snekX < 0 || snekY >= rows * isThatGlock || snekY < 0 || snekX >= columns * isThatGlock) {
        end()
        return;
    }

    // if the snake hits its own body
    for (let i of bod) {
        if (bod.length !== 1) {
            if (snekX == i[0] && snekY == i[1]) {
                end()
            }
        }
    }

    // add the current location of the snake's head to the array
    if (bod.length) {
        bod[0] = [snekX, snekY];
    }
}

const initialiseSnek = () => {
    // put the x and y coords in random place
    snekX = Math.floor(Math.random() * columns) * isThatGlock;
    snekY = Math.floor(Math.random() * rows) * isThatGlock;

    // if the provisional coords is the same as a food, return true, which activates the while loop and forces this to regenerate.
    if (foodX == snekX && foodY == snekY) {
        return true;
    }
    else {
        return false;
    }
}
const placeFood = () => {
    // put the x and y coords in random place
    foodX = Math.floor(Math.random() * columns) * isThatGlock;
    foodY = Math.floor(Math.random() * rows) * isThatGlock;

    // if the provisional coords is the same as the snake, return true, which activates the while loop and forces this to regenerate.
    if (foodX == snekX && foodY == snekY) {
        return true;
    }
    else {
        for (let i = 0; i < bod.length; i++) {
            // if it touches a body, return true, which activates the while loop and forces this to regenerate
            if ((bod[i][0] === foodX) || (bod[i][1] === foodY)) {
                return true;
            }
            else {
                return false;
            }
        }
    }
}

const move = (event) => {
    // if an arrow key is hit, adjust the direction via the x/y speed variables and rotate the snake body (this sucks but the nice solution is too complicated)
    if ((event.code === "ArrowUp" || "KeyW") && speedY != 1) {
        speedX = 0;
        speedY = -1;
        bro.src = "image-top.webp";
        snake.src = "image (2)-top.webp";
        soz.src = "image (3)-top.webp";
    }
    else if ((event.code === "ArrowDown" || "KeyS") && speedY != -1) {
        speedX = 0;
        speedY = 1;
        bro.src = "image-bottom.webp";
        snake.src = "image (2)-bottom.webp";
        soz.src = "image (3)-bottom.webp";
    }
    else if ((event.code === "ArrowLeft" || "KeyA") && speedX != 1) {
        speedX = -1;
        speedY = 0;
        bro.src = "image-left.webp";
        snake.src = "image (2)-left.webp";
        soz.src = "image (3)-left.webp";
    }
    else if ((event.code === "ArrowRight" || "KeyD") && speedX != -1) {
        speedX = 1;
        speedY = 0;
        bro.src = "image-right.webp";
        snake.src = "image (2)-right.webp";
        soz.src = "image (3)-right.webp";
    }
}

const restart = () => {
    // reset all the variables
    over = false;
    score = 0;
    snekX = isThatGlock * 5
    snekY = isThatGlock * 5
    foodX = 0;
    foodY = 0;
    speedX = 0;
    speedY = 0;
    bod = [];

    let placement = placeFood();
    while (placement) {
        placement = placeFood();
    }
    placement = initialiseSnek();
    while (placement) {
        placement = initialiseSnek();
    }

    document.getElementById("overlay").style.display = "none";
}

const end = () => {
    // load the overlay
    hit.play();
    document.getElementById("is").innerText = `The gap to pole was ${record - score}`;
    document.getElementById("scream").innerText = "Chequered flag!"
    document.getElementById("score").innerText = `Score: ${score}`;
    document.getElementById("record").innerText = `Record: ${record} set by ${recorder}`;
    if (score > record) {
        const prev = record;
        record = score;
        let name = prompt("You broke a record! Enter your name: ");
        recorder = name;
        document.getElementById("is").innerText = `The gap to P2 was ${record - prev}`;
        document.getElementById("scream").innerText = ["And that's pole position.", "P1 baby P1!!", `And the chequered flag comes out for ${name}!`, `${name} comes across the line to take victory!`][Math.floor(Math.random() * 4)]
        document.getElementById("record").innerText = `${recorder} demolished the competition with a top score of ${score}`;
    }
    over = true;
    document.getElementById("overlay").style.display = "block";
}
