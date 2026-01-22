const canvas = document.getElementById('simulationCanvas');
const toggleSimulationButton = document.getElementById('toggleSimulation');
const speedControl = document.getElementById('speedControl');
const fpsLabel = document.getElementById('fps-label');
const stepsLabel = document.getElementById('steps-label');
const aliveCellsLabel = document.getElementById('alive-cells-label');
const ctx = canvas.getContext('2d');


let animationId;
let step = 0;
let lastTimestamp = 0;
let isRunning = false;
let mouseGridPos = { x: -1, y: -1 };
let lastMouseGridPos = { x: -1, y: -1 };
let fps = parseInt(speedControl.value, 10);
let interval = 1000 / fps;
let aliveCells = 0;

const canvasRows = 100;
const canvasCols = 140;
canvas.width = canvasCols;
canvas.height = canvasRows;
ctx.imageSmoothingEnabled = false; // Disable anti-aliasing
const cellSize = canvasCols / canvasRows;
console.log('Simulation initialized');
console.log("Canvas size:", canvas.clientWidth, "x", canvas.clientHeight);

const imgData = ctx.createImageData(canvas.width, canvas.height);
const data = imgData.data;

toggleSimulationButton.addEventListener('click', () => {
    isRunning = !isRunning;
    toggleSimulationButton.textContent = isRunning ? 'Pause' : 'Start';
    fpsLabel.textContent = isRunning ? `${fps}` : '0';
});

// Tracking del mouse dentro del canvas
canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();

    const scaleX = canvas.width / rect.width;   // ej. 140 / 1920
    const scaleY = canvas.height / rect.height; // ej. 100 / 1080

    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    const xCell = Math.floor(x / cellSize);
    const yCell = Math.floor(y / cellSize);

    lastMouseGridPos.x = mouseGridPos.x;
    lastMouseGridPos.y = mouseGridPos.y;
    
    mouseGridPos.x = xCell;
    mouseGridPos.y = yCell;

    if (event.buttons === 1) { 
        if (mouseGridPos.x >= 0 && mouseGridPos.y >= 0 &&
            mouseGridPos.x < statesMatrix[0].length && mouseGridPos.y < statesMatrix.length) {
                // Toggle cell state
                if (statesMatrix[mouseGridPos.y][mouseGridPos.x] === 1) {
                    statesMatrix[mouseGridPos.y][mouseGridPos.x] = 0;
                    aliveCells--;
                } else {
                    statesMatrix[mouseGridPos.y][mouseGridPos.x] = 1;
                    aliveCells++;
                }
                aliveCellsLabel.innerText = `${aliveCells}`;
            }
        
    }
});

canvas.addEventListener('mousedown', (event) => {
    if (mouseGridPos.x >= 0 && mouseGridPos.y >= 0 &&
        mouseGridPos.x < statesMatrix[0].length && mouseGridPos.y < statesMatrix.length) {
            // Toggle cell state
            if (statesMatrix[mouseGridPos.y][mouseGridPos.x] === 1) {
                statesMatrix[mouseGridPos.y][mouseGridPos.x] = 0;
                aliveCells--;
            } else {
                statesMatrix[mouseGridPos.y][mouseGridPos.x] = 1;
                aliveCells++;
            }
            aliveCellsLabel.innerText = `${aliveCells}`;
        }
    }
);
    
canvas.addEventListener('mouseleave', () => {
    mouseGridPos.x = -1;
    mouseGridPos.y = -1;
});
    
speedControl.addEventListener('input', () => {
    fps = parseInt(speedControl.value, 10);
    interval = 1000 / fps;
    fpsLabel.textContent = isRunning ? `${fps}` : '0';
});

let statesMatrix = Array(canvasRows).fill().map(() => Array(canvasCols).fill(0));
let nextMatrix = Array(canvasRows).fill().map(() => Array(canvasCols).fill(0));

function countAliveNeighbors(matrix, x, y) {
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue; // Skip the cell itself
            const newX = x + dx;
            const newY = y + dy;
            if (newX >= 0 && newX < matrix[0].length &&
                newY >= 0 && newY < matrix.length) {
                count += matrix[newY][newX];
            }
        }
    }
    return count;
}

function drawFrame(matrix) {
    for (let y = 0; y < matrix.length; y++) {
        for (let x = 0; x < matrix[y].length; x++) {
            const index = (y * canvasCols + x) * 4;
            if (matrix[y][x] === 1) {
                data[index]     = (x*2)%255+60;
                data[index + 1] = 0; 
                data[index + 2] = (y*2)%255+60;
                data[index + 3] = 255; 
            } else {
                data[index]     = 0;
                data[index + 1] = 0; 
                data[index + 2] = 0;
                data[index + 3] = 255; 
            }
        }
    }

    ctx.putImageData(imgData, 0, 0);

    // Highlight cell under mouse
    if (mouseGridPos.x >= 0 && mouseGridPos.y >= 0 &&
        mouseGridPos.x < matrix[0].length && mouseGridPos.y < matrix.length) {
        ctx.strokeStyle = 'yellow';
        ctx.lineWidth = 1;
        ctx.strokeRect(mouseGridPos.x * cellSize, mouseGridPos.y * cellSize, cellSize, cellSize);
    }
}
async function simLoop() {

    // Birth: 3 neighbors alive
    // Death: less than 2 or more than 3 neighbors alive
    // Survival: 2 or 3 neighbors alive

    let aliveNeighbors;

    for (let y = 0; y < statesMatrix.length; y++) {
        for (let x = 0; x < statesMatrix[y].length; x++) {
            aliveNeighbors = countAliveNeighbors(statesMatrix, x, y);
            if (statesMatrix[y][x] === 0) {
                if (aliveNeighbors === 3) {
                    nextMatrix[y][x] = 1; // Birth
                    aliveCells++;
                }
            };
            if (statesMatrix[y][x] === 1) {
                if (aliveNeighbors < 2 || aliveNeighbors > 3) {
                    nextMatrix[y][x] = 0; // Death
                    aliveCells--;
                } else {
                    nextMatrix[y][x] = 1; // Survival
                };
            }
        }
    }
    statesMatrix.forEach((row, y) => {
        row.forEach((cell, x) => {
            statesMatrix[y][x] = nextMatrix[y][x];
            nextMatrix[y][x] = 0; // reset nextMatrix for the next iteration
        });
    });
}

async function mainLoop(timestamp) {

    const deltaTime = timestamp - lastTimestamp;
    if (deltaTime >= interval && isRunning) {
        await simLoop();
        lastTimestamp = timestamp - (deltaTime % interval);
        step++;
        stepsLabel.innerText = `${step}`;
        aliveCellsLabel.innerText = `${aliveCells}`;
    }
    drawFrame(statesMatrix);

    animationId = requestAnimationFrame(mainLoop);
}


requestAnimationFrame(mainLoop);
