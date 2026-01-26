const canvas = document.getElementById('simulationCanvas');
const ctx = canvas.getContext('2d');

const toggleSimulationButton = document.getElementById('toggleSimulation');
const speedControl = document.getElementById('speedControl');
const autoPauseChck = document.getElementById('autoPauseEnableBtn');
const linearInterpolationChck = document.getElementById('linearInterpolationEnableBtn');
const cellGlowChck = document.getElementById('cellGlowEnableBtn');
const ageHeatmapChck = document.getElementById('ageHeatmapEnableBtn');

const fpsLabel = document.getElementById('fps-label');
const stepsLabel = document.getElementById('steps-label');
const aliveCellsLabel = document.getElementById('alive-cells-label');
const coordLabel = document.getElementById('coordinates-label');
const zoomLabel = document.getElementById('zoom-label');
const stateLabel = document.getElementById('state-label');
const ageLabel = document.getElementById('age-label');

let animationId;
let step = 0;
let lastTimestamp = 0;
let zoomFactor = 1;

let isRunning = false;
let isSwiping = false;
let autoPauseEnabled = false;
let enableLinearInterpolation = true;
let enableAgeHeatmap = false;

let mouseGridPos = { x: -1, y: -1 };
let lastMouseGridPos = { x: -1, y: -1 };
let firstSwipePos = { x: -1, y: -1 };
let camera = {x: 0, y: 0};

let aliveCellsMap = new Map();
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
    toggleSimulationButton.classList.toggle("playing", isRunning);
    toggleSimulationButton.blur();
    
    fpsLabel.textContent = isRunning ? `${fps}` : '0';
});

speedControl.addEventListener('input', () => {
    fps = parseInt(speedControl.value, 10);
    interval = 1000 / fps;
    fpsLabel.textContent = isRunning ? `${fps}` : '0';
});

autoPauseChck.addEventListener('change', () => {
    autoPauseEnabled = autoPauseChck.checked;
    autoPauseChck.blur();
});

linearInterpolationChck.addEventListener('change', () => {
    enableLinearInterpolation = linearInterpolationChck.checked;
    linearInterpolationChck.blur();
});

cellGlowChck.addEventListener('change', () => {
    if (cellGlowChck.checked) {
        canvas.style.filter = 'drop-shadow(0 0 2px cyan) contrast(1.2)';
    } else {
        canvas.style.filter = 'none';
    }
    cellGlowChck.blur();
});

ageHeatmapChck.addEventListener('change', () => {
    enableAgeHeatmap = ageHeatmapChck.checked;
    ageHeatmapChck.blur();
});

window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') camera.y -= 2;
    if (e.key === 'ArrowDown') camera.y += 2;
    if (e.key === 'ArrowRight') camera.x += 2;
    if (e.key === 'ArrowLeft') camera.x -= 2;
    if (e.key === ' ') toggleSimulationButton.click();
});

canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    e.stopPropagation();

    const rect = canvas.getBoundingClientRect();
    let scaleX = width / rect.width;  
    let scaleY = height / rect.height;

    // anchor for camera offset when zooming
    const worldX = camera.x + (e.clientX - rect.left)* scaleX;
    const worldY = camera.y + (e.clientY - rect.top) * scaleY;

    zoomFactor *= (1 + e.deltaY * -0.0005);
    zoomFactor = Math.min(Math.max(0.05, zoomFactor), 4);

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
});

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
        if (enableLinearInterpolation) {
            const rangeX = Math.abs(mouseGridPos.x - lastMouseGridPos.x);
            const rangeY = Math.abs(mouseGridPos.y - lastMouseGridPos.y);
            const steps = Math.max(rangeX, rangeY);
            if (steps > 0) {
                for (let i = 1; i <= steps; i++) {  
                    const x = lastMouseGridPos.x + (mouseGridPos.x - lastMouseGridPos.x) * i / steps;
                    const y = lastMouseGridPos.y + (mouseGridPos.y - lastMouseGridPos.y) * i / steps;
                    if (isAlive(x, y)) {
                        aliveCellsMap.delete(`${x},${y}`);
                        aliveCells--;
                    } else {
                        aliveCellsMap.set(`${x},${y}`, {x: x, y: y, age: 0});
                        aliveCells++;
                    }
                }
            }
        }
        else {
            if (isAlive(mouseGridPos.x, mouseGridPos.y)) {
                aliveCellsMap.delete(`${mouseGridPos.x},${mouseGridPos.y}`);
                aliveCells--;
            } else {
                aliveCellsMap.set(`${mouseGridPos.x},${mouseGridPos.y}`, {x: mouseGridPos.x, y: mouseGridPos.y, age: 0});
                aliveCells++;
            }
        }
        aliveCellsLabel.innerText = `${aliveCells}`;  
        if (autoPauseEnabled) pauseSim();  
    } 

    if (isSwiping) {
        camera.x -= (mouseGridPos.x - firstSwipePos.x);
        camera.y -= (mouseGridPos.y - firstSwipePos.y);
    }

    lastMouseGridPos.x = mouseGridPos.x;
    lastMouseGridPos.y = mouseGridPos.y;

    coordLabel.innerText = `${mouseGridPos.x}, ${mouseGridPos.y}`;
    const cellAlive = aliveCellsMap.has(`${mouseGridPos.x},${mouseGridPos.y}`);
    stateLabel.innerText = cellAlive ? 'alive' : 'dead';
    ageLabel.innerText = cellAlive ? `${aliveCellsMap.get(`${mouseGridPos.x},${mouseGridPos.y}`).age}` : '-';

});

canvas.addEventListener('mousedown', (event) => {
    
    if (event.button === 0) {
        if (isAlive(mouseGridPos.x, mouseGridPos.y)) {
            aliveCellsMap.delete(`${mouseGridPos.x},${mouseGridPos.y}`);
            aliveCells--;
        } else {
            aliveCellsMap.set(`${mouseGridPos.x},${mouseGridPos.y}`, {x: mouseGridPos.x, y: mouseGridPos.y, age: 0});
            aliveCells++;
        }
        aliveCellsLabel.innerText = `${aliveCells}`;
        const cellAlive = aliveCellsMap.has(`${mouseGridPos.x},${mouseGridPos.y}`);
        stateLabel.innerText = cellAlive ? 'alive' : 'dead';
        ageLabel.innerText = cellAlive ? `${aliveCellsMap.get(`${mouseGridPos.x},${mouseGridPos.y}`).age}` : '-';
        if (autoPauseEnabled) pauseSim();
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
    coordLabel.innerText = '-';
    stateLabel.innerHTML = '-';
    ageLabel.innerText = '-';
});

canvas.addEventListener('mouseup', () => {
    isSwiping = false;
});

function pauseSim() {
    isRunning = false;
    toggleSimulationButton.classList.toggle("playing", isRunning);
}

function isAlive(x, y) {
    if (aliveCellsMap.has(`${x},${y}`)) {
        return 1;
    } else {
        return 0;
    }
}

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
    data.fill(0);
    for (const [coords, values] of aliveCellsMap) {
        const worldX = values.x;
        const worldY = values.y;
        const x = Math.floor(worldX - camera.x);
        const y = Math.floor(worldY - camera.y);
        if (x >= 0 && x < width && y >= 0 && y < height) {
            const index = (y * width + x) * 4;
            if (enableAgeHeatmap) {
                const age = values.age;
                data[index]     = Math.min(255, (age * 5 / 2));     
                data[index + 1] = Math.min(255, 255 - (age * 2 / 2)); 
                data[index + 2] = Math.min(255, 255 - (age * 5 / 2));
                data[index + 3] = 255;
            } else {
                data[index]     = Math.floor(127.5 * (1+ Math.cos((x+y)*0.01+0)));
                data[index + 1] = Math.floor(127.5 * (1+ Math.cos((x+y)*0.01+2))); 
                data[index + 2] = Math.floor(127.5 * (1+ Math.cos((x+y)*0.01+4)));
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
    const newaliveCellsMap = new Map();
    const influenceMap = new Map();
    for (const [coordinates, values] of aliveCellsMap) {
        const cellX = values.x;
        const cellY = values.y;
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue; // Skip the cell itself
                const nx = cellX + dx;
                const ny = cellY + dy;
                const neighborKey = `${nx},${ny}`

                const neighbors = influenceMap.get(neighborKey) || 0;
                influenceMap.set(neighborKey, neighbors + 1);
            }
        }
    }
    for (const [coords, neighbors] of influenceMap) {
        if (neighbors === 3) {
            // Birth
            const parts = coords.split(','); 
            const x = parseInt(parts[0]);
            const y = parseInt(parts[1]);
            newaliveCellsMap.set(coords, {x: x, y: y, age: 0});
        } else if (neighbors === 2 && aliveCellsMap.has(coords)){
            // Survival
            const oldCell = aliveCellsMap.get(coords);
            newaliveCellsMap.set(coords, {...oldCell, age: oldCell.age + 1});
        }
    }
    aliveCellsMap = newaliveCellsMap;
    aliveCells = newaliveCellsMap.size;
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
