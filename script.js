const canvas = document.getElementById('simulationCanvas');
const toggleSimulationButton = document.getElementById('toggleSimulation');
const speedControl = document.getElementById('speedControl');
const fpsLabel = document.getElementById('fps-label');
const stepsLabel = document.getElementById('steps-label');
const aliveCellsLabel = document.getElementById('alive-cells-label');
const coordLabel = document.getElementById('coordinates-label');
const zoomLabel = document.getElementById('zoom-label');
const stateLabel = document.getElementById('state-label');
const ctx = canvas.getContext('2d');

let animationId;
let step = 0;
let lastTimestamp = 0;
let zoomFactor = 1;

let isRunning = false;
let isSwiping = false;

let mouseGridPos = { x: -1, y: -1 };
let firstSwipePos = { x: -1, y: -1 };
let camera = {x: 0, y: 0};

let aliveCellsSet = new Set();
let fps = parseInt(speedControl.value, 10);
let interval = 1000 / fps;
let aliveCells = 0;

ctx.imageSmoothingEnabled = false; // Disable anti-aliasing
let width = canvas.width;
let height = canvas.height;

const originalWidth = width;
const originalHeight = height;

let imgData = ctx.createImageData(width, height);
let data = imgData.data;



toggleSimulationButton.addEventListener('click', () => {
    isRunning = !isRunning;
    toggleSimulationButton.textContent = isRunning ? 'Pause' : 'Start';
    fpsLabel.textContent = isRunning ? `${fps}` : '0';
});

window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') camera.y -= 2;
    if (e.key === 'ArrowDown') camera.y += 2;
    if (e.key === 'ArrowRight') camera.x += 2;
    if (e.key === 'ArrowLeft') camera.x -= 2;
})

canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
});

canvas.addEventListener('wheel', (e) => {
    const rect = canvas.getBoundingClientRect();
    let scaleX = width / rect.width;  
    let scaleY = height / rect.height;

    // anchor for camera offset when zooming
    const worldX = camera.x + (e.clientX - rect.left)* scaleX;
    const worldY = camera.y + (e.clientY - rect.top) * scaleY;

    zoomFactor *= (1 + e.deltaY * -0.0005);
    zoomFactor = Math.min(Math.max(0.4, zoomFactor), 4);

    canvas.width = Math.floor(originalWidth / zoomFactor);
    canvas.height = Math.floor(originalHeight / zoomFactor);
    width = canvas.width;
    height = canvas.height;
    imgData = ctx.createImageData(width, height);
    data = imgData.data;

    scaleX = width / rect.width;  
    scaleY = height / rect.height;
    // applying anchor to camera offset
    camera.x = worldX - ((e.clientX - rect.left) * scaleX);
    camera.y = worldY - ((e.clientY - rect.top) * scaleY);

    zoomLabel.innerText = `${zoomFactor.toFixed(2)}x`
})

// Mouse tracking inside the canvas
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();

    const scaleX = width / rect.width;
    const scaleY = height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    mouseGridPos.x = Math.floor(x + camera.x);
    mouseGridPos.y = Math.floor(y + camera.y);
    
    if (e.buttons === 1) { 
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

    if (isSwiping) {
        camera.x -= (mouseGridPos.x - firstSwipePos.x);
        camera.y -= (mouseGridPos.y - firstSwipePos.y);
    }

    coordLabel.innerText = `${mouseGridPos.x}, ${mouseGridPos.y}`;
    stateLabel.innerText = aliveCellsSet.has(`${mouseGridPos.x},${mouseGridPos.y}`) ? 'alive' : 'dead';

});

function isAlive(x, y) {
    if (aliveCellsSet.has(`${x},${y}`)) {
        return 1;
    } else {
        return 0;
    }
}

canvas.addEventListener('mousedown', (event) => {
    
    if (event.button === 0) {
        console.log("click:", mouseGridPos.x);
        if (isAlive(mouseGridPos.x, mouseGridPos.y)) {
            aliveCellsSet.delete(`${mouseGridPos.x},${mouseGridPos.y}`);
            aliveCells--;
        } else {
            aliveCellsSet.add(`${mouseGridPos.x},${mouseGridPos.y}`)
            aliveCells++;
        }
        aliveCellsLabel.innerText = `${aliveCells}`;
            stateLabel.innerText = aliveCellsSet.has(`${mouseGridPos.x},${mouseGridPos.y}`) ? 'alive' : 'dead';
    }
    if (event.button === 2) {
        isSwiping = true;
        firstSwipePos.x = mouseGridPos.x;
        firstSwipePos.y = mouseGridPos.y;
    }

});
    
canvas.addEventListener('mouseleave', () => {
    mouseGridPos.x = -1;
    mouseGridPos.y = -1;
    isSwiping = false;
    coordLabel.innerText = `-`;
});

canvas.addEventListener('mouseup', () => {
    isSwiping = false;
})
    
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
            const worldX = Math.floor(camera.x + x);
            const worldY = Math.floor(camera.y + y);
            const index = (y * width + x) * 4;
            if (isAlive(worldX,worldY)) {
                data[index]     = Math.floor(127.5 * (1+ Math.sin(y*0.01+0)));
                data[index + 1] = Math.floor(127.5 * (1+ Math.sin(x*0.01+2))); 
                data[index + 2] = Math.floor(127.5 * (1+ Math.sin(x*0.01+4)));
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
