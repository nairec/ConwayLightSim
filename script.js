
const canvas = document.getElementById('simulationCanvas');
const ctx = canvas.getContext('2d');

const loadFileButton = document.getElementById('load-file-btn');
const fileInput = document.getElementById('file-input');
const closeFilePopupButton = document.getElementById('close-file-popup-btn');
const saveFileButton = document.getElementById('save-file-btn');
const toggleHudButton = document.getElementById('toggle-hud-btn');
const toggleSimulationButton = document.getElementById('toggleSimulation');
const speedControl = document.getElementById('speedControl');
const masterVolumeControl = document.getElementById('masterVolume')
const autoPauseChck = document.getElementById('autoPauseEnableBtn');
const linearInterpolationChck = document.getElementById('linearInterpolationEnableBtn');
const cellGlowChck = document.getElementById('cellGlowEnableBtn');
const ageHeatmapChck = document.getElementById('ageHeatmapEnableBtn');
const patternSelectRadios = document.querySelectorAll('input[name="pattern"]');

const fpsLabel = document.getElementById('fps-label');
const stepsLabel = document.getElementById('steps-label');
const aliveCellsLabel = document.getElementById('alive-cells-label');
const coordLabel = document.getElementById('coordinates-label');
const zoomLabel = document.getElementById('zoom-label');
const stateLabel = document.getElementById('state-label');
const ageLabel = document.getElementById('age-label');
const inputFilePopup = document.getElementById('input-file-popup');

let animationId;
let step = 0;
let frame = 0;
let lastTimestamp = 0;
let globalTimestamp = 0;
let currentZoomFactor = 1;
let targetZoomFactor = 1;
let deltaTime;
let rect = canvas.getBoundingClientRect();
let audioSmoothedDensity = 0;
let smoothedBirths = 0;
let lastAudioUpdateTime;

let isRunning = false;
let isSwiping = false;
let autoPauseEnabled = false;
let enableLinearInterpolation = true;
let enableAgeHeatmap = false;
let wasRunningBeforeInteraction = false;
let isAudioPlaying = false;
let isAudioInitialized = false;
let isAudioFadingIn = false;
let isFileInputOpen = false;
let showHud = true;

let selectedPattern = 'single';
let currentGhost = PATTERNMAPPING['single'];

let rawMousePos ={x: -1, y: -1};
let mouseInput = { x: -1, y: -1, isDown: false, intention: 'DRAW' };
let lastMouseInput = {x: -1, y: -1};
let mouseGridPos = { x: -1, y: -1 };
let lastMouseGridPos = { x: -1, y: -1 };
let firstSwipePos = { x: -1, y: -1 };
let camera = {x: 0, y: 0};
let targetCamera = {x: 0, y: 0}
let zoomInput = {
    hasZoom: false,
    deltaY: 0,
    zoomX: 0,
    zoomY: 0
}

let aliveCellsMap = new Map();
let fps = parseInt(speedControl.value, 10);
let masterVolume = parseInt(masterVolumeControl.value, 10);
let interval = 1000 / fps;
let aliveCells = 0;
let lastFrameBirths = 0;

ctx.imageSmoothingEnabled = false; // Disable anti-aliasing
let width = canvas.width;
let height = canvas.height;

const originalWidth = width;
const originalHeight = height;
const minLog = Math.log(0.05);
const maxLog = Math.log(4);
const SHIFT = 32n;
const Y_MASK = 0xFFFFFFFFn;

let imgData = ctx.createImageData(width, height);
let data = imgData.data;

// Audio setup
let droneSynth;
let droneFilter;
let droneChorus;
let droneReverb;
let birthFx;

// Event listeners
window.addEventListener('resize', () => {
    rect = canvas.getBoundingClientRect();
});

loadFileButton.addEventListener('click', () => {
    loadFileButton.blur();
    isFileInputOpen = !isFileInputOpen;
    if (isFileInputOpen) {
        inputFilePopup.style.top = '40%';
    } else {
        inputFilePopup.style.top = '110%';

    }
})

fileInput.addEventListener('change', () => {
    fileInput.blur();
    const selectedFile = fileInput.files[0];
    if (!selectedFile.name.endsWith('.rle')) {
        alert("The selected file does not seem to be a .rle file!");
    } else {
        const reader = new FileReader();
        let fileText = '';
        try {
            reader.onload = function () {
                fileText += reader.result;
                let parsedCells = parseRLE(fileText);
                loadFromParsed(aliveCellsMap, parsedCells);
                loadFileButton.click();
            }
            reader.readAsText(selectedFile);  
        } catch (error) {
            console.error(error);
        }
    }
})

closeFilePopupButton.addEventListener('click', () => {
    loadFileButton.click();
});


saveFileButton.addEventListener('click', () => {
    saveFileButton.blur();
    const rleData = saveStateAsRLE(aliveCellsMap);
    const blob = new Blob([rleData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'conway_pattern.rle';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

toggleHudButton.addEventListener('click', () => {
    toggleHudButton.blur();
    showHud = !showHud;
    if (showHud) {
        document.getElementById('hide-hud-icon').style.display = 'inline';
        document.getElementById('show-hud-icon').style.display = 'none';
        document.querySelector('.metadata-group').style.display = 'flex';
        document.querySelector('.right-panel').style.display = 'flex';
        document.querySelector('.footer-info').style.display = 'flex';
    } else {
        document.getElementById('hide-hud-icon').style.display = 'none';
        document.getElementById('show-hud-icon').style.display = 'inline';
        document.querySelector('.metadata-group').style.display = 'none';
        document.querySelector('.right-panel').style.display = 'none';
        document.querySelector('.footer-info').style.display = 'none';
    }
});

toggleSimulationButton.addEventListener('click', () => {
    startAudioEngine();
    isRunning = !isRunning;
    toggleSimulationButton.classList.toggle("playing", isRunning);
    toggleSimulationButton.blur();

    if (isAudioInitialized) {
        if (isRunning) {
            Tone.Destination.volume.rampToh &(masterVolume, 0.5);
        } else {
            Tone.Destination.volume.rampTo(-Infinity, 1.5);
        }
    }
    
    fpsLabel.textContent = isRunning ? `${fps}` : '0';
});

speedControl.addEventListener('input', () => {
    fps = parseInt(speedControl.value, 10);
    interval = 1000 / fps;
    fpsLabel.textContent = isRunning ? `${fps}` : '0';
});

masterVolumeControl.addEventListener('input', () => {
    masterVolume = parseInt(masterVolumeControl.value, 10);
    if (isAudioInitialized) {
        Tone.Destination.volume.rampTo(masterVolume, 0.1);
    }
})

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

patternSelectRadios.forEach(radio => {
    radio.addEventListener('change', () => {
        selectedPattern = radio.value;
        currentGhost = PATTERNMAPPING[selectedPattern];
        radio.blur();
    })
});
        

window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.key === 'ArrowUp') camera.y -= 2;
    if (e.key === 'ArrowDown') camera.y += 2;
    if (e.key === 'ArrowRight') camera.x += 2;
    if (e.key === 'ArrowLeft') camera.x -= 2;
    if (e.key === ' ') toggleSimulationButton.click();
    if (e.key === 'r') currentGhost = getRotatedPattern(currentGhost);
});

canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    e.stopPropagation();

    zoomInput.hasZoom = true;
    zoomInput.deltaY += e.deltaY;
    zoomInput.zoomX = e.clientX;
    zoomInput.zoomY = e.clientY;
}, { passive: false });

// Mouse tracking inside the canvas
canvas.addEventListener('mousemove', (e) => {

    rawMousePos.x = e.clientX;
    rawMousePos.y = e.clientY;

    const scaleX = width / rect.width;
    const scaleY = height / rect.height;

    mouseInput.x = (e.clientX - rect.left) * scaleX;
    mouseInput.y = (e.clientY - rect.top) * scaleY;
    
    mouseInput.isDown = (e.buttons === 1);
});

canvas.addEventListener('mousedown', (e) => {

    wasRunningBeforeInteraction = isRunning;
    
    if (isRunning) {
        isRunning = false;
    }
    
    mouseInput.isDown = (e.buttons === 1);
    mouseInput.intention = isAlive(mouseGridPos.x, mouseGridPos.y) ? 'ERASE' : 'DRAW';
    if (e.buttons === 2) {
        isSwiping = true;
        firstSwipePos.x = mouseGridPos.x;
        firstSwipePos.y = mouseGridPos.y;
    }
    
    startAudioEngine();
});

canvas.addEventListener('mouseleave', () => {
    mouseGridPos.x = -1;
    mouseGridPos.y = -1;
    isSwiping = false;
    mouseInput.isDown = false;
    coordLabel.innerText = '-';
    stateLabel.innerHTML = '-';
    ageLabel.innerText = '-';
});

canvas.addEventListener('mouseup', () => {
    isSwiping = false;
    mouseInput.isDown = false;

    if (wasRunningBeforeInteraction && !autoPauseEnabled) {
        isRunning = true;
        wasRunningBeforeInteraction = false;
    }
});

// Hashing functions for cell coordinates
function getHash(x, y) {
    return (BigInt(x) << SHIFT) | (BigInt(y) & Y_MASK);
}

function getCoordsFromHash(hash) {
    const x = Number(hash >> SHIFT);
    
    let y = Number(hash & Y_MASK);
    
    if (y > 0x7FFFFFFF) {
        y -= 0x100000000; 
    }

    return { x, y };
}

// Audio functions
async function startAudioEngine() {
    if (isAudioInitialized) return;
    
    Tone.context.lookAhead = 0.5;
    await Tone.start(); 
    initializeSynths(); 
    isAudioInitialized = true;
}

function initializeSynths() {
 
    createDrone();
    
    droneSynth.volume.value = -Infinity
    droneSynth.start();

    isAudioFadingIn = true;

    droneSynth.volume.rampTo(-45, 2);
    droneSynth.frequency.value = 40;

    setTimeout(() => {
        isAudioFadingIn = false;
    }, 2000);
}


function createDrone() {

    droneSynth = new Tone.FatOscillator({
        type: "sawtooth",
        count: 2,          
        spread: 20         
    });

    birthFx = new Tone.Filter({
        type: "peaking", 
        frequency: 800,  
        Q: 1,   
        gain: 0   
    });
    
    droneFilter = new Tone.Filter({
        frequency: 400,
        type: "lowpass",
        rolloff: -24 
    });
    
    droneChorus = new Tone.Chorus({
        frequency: 0.5,
        delayTime: 2.5,
        depth: 0.7,   
        wet: 0.5     
    }).start(); 

    droneReverb = new Tone.Freeverb({
        roomSize: 0.9, 
        dampening: 3000, 
        wet: 0.5
    });

    panner = new Tone.Panner(0);

    const limiter = new Tone.Limiter(-1).toDestination();
    
    droneSynth.chain(droneFilter, droneChorus, droneReverb, birthFx, panner, limiter);

}

function updateAudio(normZoomFactor, visibleCells, panningRatio) {
    if (!droneFilter || (globalTimestamp - lastAudioUpdateTime) < 100) return;

    lastAudioUpdateTime = globalTimestamp;
    const rawDensity = Math.min((visibleCells * 2.0) / 5000, 1);
    const reactionSpeed = 3.0; 
    let step = reactionSpeed * deltaTime;
    
    if (step > 1) step = 1;

    audioSmoothedDensity += (rawDensity - audioSmoothedDensity) * step;

    const densityFreq = 350 + (audioSmoothedDensity * 4800);
    const newFrequency = 350 + ( (densityFreq - 200) * normZoomFactor );        
    droneFilter.frequency.setTargetAtTime(newFrequency, Tone.now(), 0.25); 
    droneReverb.wet.setTargetAtTime((1-normZoomFactor), Tone.now(), 0.1);

    if (!isAudioFadingIn) {
        const targetVolume = -45 + (audioSmoothedDensity * 10) - ((1 - normZoomFactor) * 5);
        droneSynth.volume.setTargetAtTime(targetVolume, Tone.now(), 0.2);
    }

    const rawBirthRate = Math.min(lastFrameBirths / 500, 1); 
    
    smoothedBirths += (rawBirthRate - smoothedBirths) * 0.05;

    const boostGain = smoothedBirths * 20; 
    const boostFreq = 800 + (smoothedBirths * 2000);
    
    birthFx.gain.setTargetAtTime(boostGain, Tone.now(), 0.1);
    birthFx.frequency.setTargetAtTime(boostFreq, Tone.now(), 0.1);

    panner.pan.setTargetAtTime(panningRatio, Tone.now(), 0.5);


}

// Other functions
function paintOnMouse() {
    if (autoPauseEnabled) {
        pauseSim();
    }
    if (enableLinearInterpolation) {
        const rangeX = Math.abs(mouseGridPos.x - lastMouseGridPos.x);
        const rangeY = Math.abs(mouseGridPos.y - lastMouseGridPos.y);
        const steps = Math.max(rangeX, rangeY);
        if (steps > 0) {
            for (let i = 1; i <= steps; i++) {  
                const x = lastMouseGridPos.x + (mouseGridPos.x - lastMouseGridPos.x) * i / steps;
                const y = lastMouseGridPos.y + (mouseGridPos.y - lastMouseGridPos.y) * i / steps;
                drawPattern('SPAWN', x, y);
            }
        } else {
            drawPattern('SPAWN', mouseGridPos.x, mouseGridPos.y);
        }
    }
    else {
        drawPattern('SPAWN', mouseGridPos.x, mouseGridPos.y);
    }
}

function processZoom() {

    rect = canvas.getBoundingClientRect();

    // input
    if (zoomInput.hasZoom) {

        let targetScaleX = (originalWidth / targetZoomFactor) / rect.width;
        let targetScaleY = (originalHeight / targetZoomFactor) / rect.height;

        const mouseWorldX = targetCamera.x + (zoomInput.zoomX - rect.left) * targetScaleX;
        const mouseWorldY = targetCamera.y + (zoomInput.zoomY - rect.top) * targetScaleY;

        targetZoomFactor *= (1 + zoomInput.deltaY * -0.0005);
        targetZoomFactor = Math.min(Math.max(0.05, targetZoomFactor), 4);
        
        let newTargetScaleX = (originalWidth / targetZoomFactor) / rect.width;
        let newTargetScaleY = (originalHeight / targetZoomFactor) / rect.height;

        targetCamera.x = mouseWorldX - (zoomInput.zoomX - rect.left) * newTargetScaleX;
        targetCamera.y = mouseWorldY - (zoomInput.zoomY - rect.top) * newTargetScaleY;

        zoomInput.hasZoom = false;
        zoomInput.deltaY = 0;
    }

    // Interpolation
    
    const lerpSpeed = 0.30;

    if (Math.abs(targetZoomFactor - currentZoomFactor) < 0.001 && 
        Math.abs(targetCamera.x - camera.x) < 0.1) {
            currentZoomFactor = targetZoomFactor;
            camera.x = targetCamera.x;
            camera.y = targetCamera.y;
    } else {
        currentZoomFactor += (targetZoomFactor - currentZoomFactor) * lerpSpeed;
        camera.x += (targetCamera.x - camera.x) * lerpSpeed;
        camera.y += (targetCamera.y - camera.y) * lerpSpeed;
    }

    // Render

    canvas.width = Math.floor(originalWidth / currentZoomFactor) & ~1;
    canvas.height = Math.floor(originalHeight / currentZoomFactor) & ~1;
    width = canvas.width;
    height = canvas.height;
    
    imgData = ctx.createImageData(width, height);
    data = imgData.data;

    zoomLabel.innerText = `${currentZoomFactor.toFixed(2)}x`;
    
    let currentScaleX = width / rect.width;
    let currentScaleY = height / rect.height;
    mouseInput.x = (rawMousePos.x - rect.left) * currentScaleX;
    mouseInput.y = (rawMousePos.y - rect.top) * currentScaleY;
}

function pauseSim() {
    toggleSimulationButton.classList.toggle("playing", isRunning);
    isRunning = false;

    if (isAudioInitialized) {
        Tone.Destination.volume.rampTo(-Infinity, 1.5);
    }
}

function isAlive(x, y) {
    if (aliveCellsMap.has(getHash(x, y))) {
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

function cellAction(x, y, intention) {
    let hash = getHash(x, y);
    if (intention === 'ERASE') {
        aliveCellsMap.delete(hash);
        aliveCells--;
    } else {
        if (!aliveCellsMap.has(hash)) {
            aliveCellsMap.set(hash, {x: x, y: y, age: 0});
            aliveCells++;
        }
    }
}

function getRotatedPattern(pattern) {
    const rotated = pattern.map((point) => {
        return {x: -point.y, y: point.x};
    });
    return rotated;
}

// Spawns or highlights the selected pattern at the mouse position
function drawPattern(drawMode, x, y) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (drawMode === 'HIGHLIGHT') {
        for (const offset of currentGhost) {
            const cellX = x + offset.x;
            const cellY = y + offset.y;
            if (cellX >= 0 && cellX < width && cellY >= 0 && cellY < height) {
                const index = (cellY * width + cellX) * 4;
                data[index]     = data[index] + 100;   
                data[index + 1] = data[index + 1] + 100; 
                data[index + 2] = data[index + 2] + 100;   
                data[index + 3] = 128; 
            }
        }
    } else if (drawMode === 'SPAWN') {
        for (const offset of currentGhost) {
            const cellX = x + offset.x;
            const cellY = y + offset.y;
            cellAction(cellX, cellY, mouseInput.intention);
        }
    }
    aliveCellsLabel.innerText = `${aliveCells}`;
}

function drawFrame() {

    // handle zooming
    processZoom();

    let rightCells = 0;
    let leftCells = 0;
    let visibleCells = 0;
    let panningRatio;
    let normalizedZoomFactor = (Math.log(currentZoomFactor) - minLog) / (maxLog - minLog);

    data.fill(0);

    // prepare mouse grid position
    mouseGridPos.x = Math.floor(mouseInput.x + camera.x);
    mouseGridPos.y = Math.floor(mouseInput.y + camera.y);
    
    // Update HUD
    coordLabel.innerText = `${mouseGridPos.x}, ${mouseGridPos.y}`;
    const cellAlive = aliveCellsMap.has(getHash(mouseGridPos.x, mouseGridPos.y));
    stateLabel.innerText = cellAlive ? 'alive' : 'dead';
    ageLabel.innerText = cellAlive ? `${aliveCellsMap.get(getHash(mouseGridPos.x, mouseGridPos.y)).age}` : '-';

    // handle events
    if (mouseInput.isDown) {
        paintOnMouse();
    }
    if (isSwiping) {
        const deltaX = mouseInput.x - lastMouseInput.x;
        const deltaY = mouseInput.y - lastMouseInput.y;

        targetCamera.x -= deltaX;
        targetCamera.y -= deltaY;
        
        camera.x = targetCamera.x;
        camera.y = targetCamera.y;
    }
    
    const camX = Math.floor(camera.x);
    const camY = Math.floor(camera.y);
    // Paint the canvas
    for (const [coords, values] of aliveCellsMap) {
        const worldX = values.x;
        const worldY = values.y;
        const x = worldX - camX;
        const y = worldY - camY;
        if (x >= 0 && x < width && y >= 0 && y < height) {

            (x >= width / 2) ? rightCells++ : leftCells++;
            
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

    drawPattern('HIGHLIGHT', Math.floor(mouseGridPos.x - camera.x), Math.floor(mouseGridPos.y - camera.y));

    visibleCells = leftCells + rightCells;
    if (visibleCells == 0) panningRatio = 0;
    else {
        panningRatio = (rightCells - leftCells) / visibleCells * 0.8;
    }

    updateAudio(normalizedZoomFactor, visibleCells, panningRatio);
    
    ctx.putImageData(imgData, 0, 0);

    // update variables for next frame
    lastMouseGridPos.x = mouseGridPos.x;
    lastMouseGridPos.y = mouseGridPos.y;
    frame++;

    lastMouseInput.x = mouseInput.x;
    lastMouseInput.y = mouseInput.y;
    
    frame++;

}

async function simLoop() {

    // Birth: 3 neighbors alive
    // Death: less than 2 or more than 3 neighbors alive
    // Survival: 2 or 3 neighbors alive
    let frameBirths = 0;
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
                const neighborHash = getHash(nx, ny);

                const neighbors = influenceMap.get(neighborHash) || 0;
                influenceMap.set(neighborHash, neighbors + 1);
            }
        }
    }
    for (const [hash, neighbors] of influenceMap) {
        if (neighbors === 3) {
            // Birth
            const {x, y} = getCoordsFromHash(hash);
            newaliveCellsMap.set(hash, {x: x, y: y, age: 0});
            frameBirths++;
        } else if (neighbors === 2 && aliveCellsMap.has(hash)){
            // Survival
            const oldCell = aliveCellsMap.get(hash);
            newaliveCellsMap.set(hash, {...oldCell, age: oldCell.age + 1});
        }
    }
    aliveCellsMap = newaliveCellsMap;
    aliveCells = newaliveCellsMap.size;
    lastFrameBirths = frameBirths;
}

async function mainLoop(timestamp) {

    globalTimestamp = timestamp;
    deltaTime = timestamp - lastTimestamp;
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
