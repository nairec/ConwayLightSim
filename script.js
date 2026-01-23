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
let camera = {x: 0, y: 0};
let aliveCellsSet = new Set();
let fps = parseInt(speedControl.value, 10);
let interval = 1000 / fps;
let aliveCells = 0;

ctx.imageSmoothingEnabled = false; // Disable anti-aliasing
const width = canvas.width;
const height = canvas.height;
const cellSize = 1;
const imgData = ctx.createImageData(width, height);
const data = imgData.data;

console.log("width:", width);
console.log("height:", height);

toggleSimulationButton.addEventListener('click', () => {
    isRunning = !isRunning;
    toggleSimulationButton.textContent = isRunning ? 'Pause' : 'Start';
    fpsLabel.textContent = isRunning ? `${fps}` : '0';
});

// Mouse tracking inside the canvas
canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();

    const scaleX = width / rect.width;   // ej. 140 / 1920
    const scaleY = height / rect.height; // ej. 100 / 1080

    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    const xCell = Math.floor(x / cellSize);
    const yCell = Math.floor(y / cellSize);

    lastMouseGridPos.x = mouseGridPos.x;
    lastMouseGridPos.y = mouseGridPos.y;
    
    mouseGridPos.x = xCell;
    mouseGridPos.y = yCell;

    if (event.buttons === 1) { 
        // Toggle cell state
        if (isAlive(mouseGridPos.x, mouseGridPos.y)) {
            aliveCellsSet.delete(`${mouseGridPos.x},${mouseGridPos.y}`);
            aliveCells--;
        } else {
            aliveCellsSet.add(`${mouseGridPos.x},${mouseGridPos.y}`)
            aliveCells++;
        }
        aliveCellsLabel.innerText = `${aliveCells}`;    
    } 
});

function isAlive(x, y) {
    if (aliveCellsSet.has(`${x},${y}`)) {
        return 1;
    } else {
        return 0;
    }
}

canvas.addEventListener('mousedown', (event) => {
    
    console.log("click:", mouseGridPos.x);
    if (isAlive(mouseGridPos.x, mouseGridPos.y)) {
        aliveCellsSet.delete(`${mouseGridPos.x},${mouseGridPos.y}`);
        aliveCells--;
    } else {
        aliveCellsSet.add(`${mouseGridPos.x},${mouseGridPos.y}`)
        aliveCells++;
    }
    aliveCellsLabel.innerText = `${aliveCells}`;

});
    
canvas.addEventListener('mouseleave', () => {
    mouseGridPos.x = -1;
    mouseGridPos.y = -1;
});
    
speedControl.addEventListener('input', () => {
    fps = parseInt(speedControl.value, 10);
    interval = 1000 / fps;
    fpsLabel.textContent = isRunning ? `${fps}` : '0';
});

function countAliveNeighbors(x, y) {
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue; // Skip the cell itself
            count += isAlive(x+dx,y+dy);
        }
    }
    return count;
}

function drawFrame() {
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const worldX = camera.x + x;
            const worldY = camera.y + y;
            const index = (y * width + x) * 4;
            if (isAlive(worldX,worldY)) {
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
}
async function simLoop() {

    // Birth: 3 neighbors alive
    // Death: less than 2 or more than 3 neighbors alive
    // Survival: 2 or 3 neighbors alive
    const newAliveCellsSet = new Set();
    const influenceMap = new Map();
    for (const cell of aliveCellsSet) {
        const cellX = parseInt(cell.split(",")[0]);
        const cellY = parseInt(cell.split(",")[1]);
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue; // Skip the cell itself
                const value = influenceMap.get(`${cellX+dx},${cellY+dy}`) || 0;
                influenceMap.set(`${cellX+dx},${cellY+dy}`, value + 1);
            }
        }
    }
    for (const [coords, neighbours] of influenceMap) {
        const cellX = parseInt(coords.split(",")[0]);
        const cellY = parseInt(coords.split(",")[1]);
        console.log(`${coords}: ${neighbours}`);
        if (neighbours === 3) {
            newAliveCellsSet.add(`${cellX},${cellY}`);
        } else if (neighbours === 2 && aliveCellsSet.has(`${cellX},${cellY}`)){
            newAliveCellsSet.add(`${cellX},${cellY}`);
        }
    }
    aliveCellsSet = newAliveCellsSet;
    aliveCells = newAliveCellsSet.size;
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
    drawFrame();

    animationId = requestAnimationFrame(mainLoop);
}


requestAnimationFrame(mainLoop);
