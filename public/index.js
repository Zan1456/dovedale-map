// DOM elements
const canvas = document.querySelector('canvas');
const players = document.getElementById('players');
const context = canvas.getContext('2d');
const tooltip = document.getElementById('tooltip');
const serverSelect = document.getElementById('servers');

// State variables
let serverData = {};
let currentServer = 'all';
let hoveredPlayer = null;
let lastX = canvas.width / 2;
let lastY = canvas.height / 2;
let dragStart = null;
let isDragging = false;
let currentScale = 1;
let touchStartX, touchStartY;
let lastTouchDistance = 0;

// Map configuration
const TOP_LEFT = { x: -23818, y: -10426 };
const BOTTOM_RIGHT = { x: 20504, y: 11377 };
const WORLD_WIDTH = BOTTOM_RIGHT.x - TOP_LEFT.x;
const WORLD_HEIGHT = BOTTOM_RIGHT.y - TOP_LEFT.y;
const WORLD_CENTRE_X = (TOP_LEFT.x + BOTTOM_RIGHT.x) / 2;
const WORLD_CENTRE_Y = (TOP_LEFT.y + BOTTOM_RIGHT.y) / 2;
const ENABLE_TRAIN_INFO = false;

// Map configuration for 16 images (1x16 grid)
const MAP_CONFIG = {
    rows: 1,    // 1 row for 1x16 layout
    cols: 16,    // 16 columns for 1x16 layout
    totalWidth: 28680,  // Adjust based on your actual map dimensions
    totalHeight: 13724  // Adjust based on your actual map dimensions
};

// Map images array
const mapImages = [];
let loadedImages = 0;
const totalImages = MAP_CONFIG.rows * MAP_CONFIG.cols;

// Initialize map images array
for (let row = 0; row < MAP_CONFIG.rows; row++) {
    mapImages[row] = [];
    for (let col = 0; col < MAP_CONFIG.cols; col++) {
        const img = new Image();
        // Adjust the path pattern based on your naming convention
        img.src = `/images/row-${row + 1}-column-${col + 1}.png`;
        
		img.onload = () => {
			loadedImages++;
			drawScene(); // draw as soon as this image is ready
		};
        
		img.onerror = () => {
			console.error(`Failed to load image: ${img.src}`);
			loadedImages++;
			drawScene(); // still redraw so we can show any other loaded images
		};
				
        mapImages[row][col] = img;
    }
}

trackTransforms();
initializeMap();

// Initialize canvas transform tracking
trackTransforms();

function getCanvasCoordinates(event) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
}

function getDistanceBetweenTouches(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
}

function zoomAt(screenX, screenY, scaleFactor) {
    const point = context.transformedPoint(screenX, screenY);
    context.translate(point.x, point.y);
    context.scale(scaleFactor, scaleFactor);
    context.translate(-point.x, -point.y);

    currentScale *= scaleFactor;
    drawScene();
}

// Load map images
function initializeMap() {
    // Ensure canvas is properly sized
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const CANVAS_CENTRE = worldToCanvas(WORLD_CENTRE_X, WORLD_CENTRE_Y);
    context.translate(window.innerWidth / 2 - CANVAS_CENTRE.x, window.innerHeight / 2 - CANVAS_CENTRE.y);
    drawScene();
}

// Enable dragging and zooming
canvas.addEventListener('mousedown', (event) => {
    const mousePos = getCanvasCoordinates(event);
    dragStart = context.transformedPoint(mousePos.x, mousePos.y);
    isDragging = true;
});

canvas.addEventListener('mousemove', (event) => {
    if (!isDragging) return;

    const mousePos = getCanvasCoordinates(event);
    const currentPoint = context.transformedPoint(mousePos.x, mousePos.y);
    const dx = currentPoint.x - dragStart.x;
    const dy = currentPoint.y - dragStart.y;

    context.translate(dx, dy);
    drawScene();
});

canvas.addEventListener('mouseup', () => {
    isDragging = false;
    dragStart = null;
});

canvas.addEventListener('mouseleave', () => {
    isDragging = false;
    dragStart = null;
});

// Zoom with mouse wheel
canvas.addEventListener('wheel', (event) => {
    event.preventDefault();

    const zoomIntensity = 0.1;
    const scale = event.deltaY < 0 ? 1 + zoomIntensity : 1 - zoomIntensity;
    const mousePos = getCanvasCoordinates(event);

    zoomAt(mousePos.x, mousePos.y, scale);
}, { passive: false });

// Touch support: drag with one finger, pinch-to-zoom with two
canvas.addEventListener('touchstart', (event) => {
    if (event.touches.length === 1) {
        const touchPos = getCanvasCoordinates(event.touches[0]);
        dragStart = context.transformedPoint(touchPos.x, touchPos.y);
        isDragging = true;
    } else if (event.touches.length === 2) {
        lastTouchDistance = getDistanceBetweenTouches(event.touches);
    }
}, { passive: false });

canvas.addEventListener('touchmove', (event) => {
    event.preventDefault();

    if (event.touches.length === 1 && isDragging) {
        const touchPos = getCanvasCoordinates(event.touches[0]);
        const currentPoint = context.transformedPoint(touchPos.x, touchPos.y);
        const dx = currentPoint.x - dragStart.x;
        const dy = currentPoint.y - dragStart.y;

        context.translate(dx, dy);
        drawScene();
    } else if (event.touches.length === 2) {
        const newDistance = getDistanceBetweenTouches(event.touches);
        const scale = newDistance / lastTouchDistance;

        const centerX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
        const centerY = (event.touches[0].clientY + event.touches[1].clientY) / 2;

        zoomAt(centerX, centerY, scale);
        lastTouchDistance = newDistance;
    }
}, { passive: false });

canvas.addEventListener('touchend', () => {
    if (event.touches.length < 2) lastTouchDistance = 0;
    if (event.touches.length === 0) {
        isDragging = false;
        dragStart = null;
    }
});

// Transform tracking system
function trackTransforms() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    let transform = svg.createSVGMatrix();

    context.getTransform = () => transform;

    const savedTransforms = [];
    const originalSave = context.save;
    const originalRestore = context.restore;
    const originalScale = context.scale;
    const originalTranslate = context.translate;

    context.save = function() {
        savedTransforms.push(transform.translate(0, 0));
        return originalSave.call(context);
    };

    context.restore = function() {
        transform = savedTransforms.pop();
        return originalRestore.call(context);
    };

    context.scale = function(sx, sy) {
        transform = transform.scaleNonUniform(sx, sy);
        currentScale *= sx;
        return originalScale.call(context, sx, sy);
    };

    context.translate = function(dx, dy) {
        transform = transform.translate(dx, dy);
        return originalTranslate.call(context, dx, dy);
    };

    const point = svg.createSVGPoint();
    context.transformedPoint = function(x, y) {
        point.x = x;
        point.y = y;
        return point.matrixTransform(transform.inverse());
    };
}

// Server management
function updateServerList() {
    const currentServers = Object.keys(serverData);
    const existingServers = Array.from(serverSelect.options).slice(1).map(opt => opt.value);
    
    if (currentServers.length !== existingServers.length || 
        !currentServers.every(server => existingServers.includes(server))) {
        
        const selectedValue = serverSelect.value;
        const totalPlayers = Object.values(serverData).reduce((count, players) => count + players.length, 0);
        
        let html = `<option value="all">All Servers (${totalPlayers})</option>`;
        
        currentServers.forEach(jobId => {
            const serverName = jobId.length > 6 ? `Server ${jobId.substring(jobId.length - 6)}` : `Server ${jobId}`;
            const playerCount = serverData[jobId].length;
            const selected = selectedValue === jobId ? ' selected' : '';
            html += `<option value="${jobId}"${selected}>${serverName} (${playerCount})</option>`;
        });

        serverSelect.innerHTML = html;

        if (selectedValue !== 'all' && !currentServers.includes(selectedValue)) {
            serverSelect.value = 'all';
            currentServer = 'all';
        } else {
            serverSelect.value = selectedValue;
        }
    }
}

function getAllPlayers() {
    return currentServer === 'all' ? Object.values(serverData).flat() : (serverData[currentServer] || []);
}

// Coordinate conversion
function worldToCanvas(worldX, worldY) {
    const relativeX = (worldX - TOP_LEFT.x) / WORLD_WIDTH;
    const relativeY = (worldY - TOP_LEFT.y) / WORLD_HEIGHT;

    const mapWidth = MAP_CONFIG.totalWidth;
    const mapHeight = MAP_CONFIG.totalHeight;
    const mapAspectRatio = mapWidth / mapHeight;
    const canvasAspectRatio = canvas.width / canvas.height;
    
    const scaleFactor = mapAspectRatio > canvasAspectRatio ? 
        canvas.width / mapWidth : canvas.height / mapHeight;
    
    const scaledMapWidth = mapWidth * scaleFactor;
    const scaledMapHeight = mapHeight * scaleFactor;
    const offsetX = (canvas.width - scaledMapWidth) / 2;
    const offsetY = (canvas.height - scaledMapHeight) / 2;

    return {
        x: offsetX + relativeX * scaledMapWidth,
        y: offsetY + relativeY * scaledMapHeight,
    };
}

// Player color calculation
function getPlayerColour(name) {
    if (!name) return '#00FFFF';

    const NAME_COLORS = ['#FD2943', '#01A2FF', '#02B857', '#A75EB8', '#F58225', '#F5CD30', '#E8BAC8', '#D7C59A'];
    
    let value = 0;
    for (let i = 0; i < name.length; i++) {
        const charValue = name.charCodeAt(i);
        let reverseIndex = name.length - i;
        if (name.length % 2 === 1) reverseIndex--;
        value += reverseIndex % 4 >= 2 ? -charValue : charValue;
    }
    
    const colorIndex = ((value % NAME_COLORS.length) + NAME_COLORS.length) % NAME_COLORS.length;
    return NAME_COLORS[colorIndex];
}

// Drawing functions
function drawGrid() {
    context.strokeStyle = '#333333';
    context.lineWidth = 1;
    const gridSize = 500;

    for (let x = TOP_LEFT.x; x <= BOTTOM_RIGHT.x; x += gridSize) {
        const start = worldToCanvas(x, TOP_LEFT.y);
        const end = worldToCanvas(x, BOTTOM_RIGHT.y);
        context.beginPath();
        context.moveTo(start.x, start.y);
        context.lineTo(end.x, end.y);
        context.stroke();
    }

    for (let y = TOP_LEFT.y; y <= BOTTOM_RIGHT.y; y += gridSize) {
        const start = worldToCanvas(TOP_LEFT.x, y);
        const end = worldToCanvas(BOTTOM_RIGHT.x, y);
        context.beginPath();
        context.moveTo(start.x, start.y);
        context.lineTo(end.x, end.y);
        context.stroke();
    }
}

function drawScene() {
    const transformedP1 = context.transformedPoint(0, 0);
    const transformedP2 = context.transformedPoint(canvas.width, canvas.height);
    context.clearRect(transformedP1.x, transformedP1.y, transformedP2.x - transformedP1.x, transformedP2.y - transformedP1.y);

    if (loadedImages === totalImages) {
        const mapWidth = MAP_CONFIG.totalWidth;
        const mapHeight = MAP_CONFIG.totalHeight;
        const mapAspectRatio = mapWidth / mapHeight;
        const canvasAspectRatio = canvas.width / canvas.height;
        
        const scaleFactor = mapAspectRatio > canvasAspectRatio ? 
            canvas.width / mapWidth : canvas.height / mapHeight;
        
        const scaledMapWidth = mapWidth * scaleFactor;
        const scaledMapHeight = mapHeight * scaleFactor;
        const offsetX = (canvas.width - scaledMapWidth) / 2;
        const offsetY = (canvas.height - scaledMapHeight) / 2;

        // Calculate chunk dimensions
        const chunkWidth = mapWidth / MAP_CONFIG.cols;
        const chunkHeight = mapHeight / MAP_CONFIG.rows;
        const scaledChunkWidth = chunkWidth * scaleFactor;
        const scaledChunkHeight = chunkHeight * scaleFactor;

        // Draw each chunk with slight overlap to prevent gaps
        for (let row = 0; row < MAP_CONFIG.rows; row++) {
            for (let col = 0; col < MAP_CONFIG.cols; col++) {
                const img = mapImages[row][col];
                if (img && img.complete) {
                    const destX = offsetX + col * scaledChunkWidth;
                    const destY = offsetY + row * scaledChunkHeight;
                    
                    // Add small overlap to prevent gaps
                    const overlap = 0.5;
                    const drawWidth = scaledChunkWidth + (col < MAP_CONFIG.cols - 1 ? overlap : 0);
                    const drawHeight = scaledChunkHeight + (row < MAP_CONFIG.rows - 1 ? overlap : 0);
                    
                    context.drawImage(
                        img,
                        0, 0, img.width, img.height,
                        destX, destY, drawWidth, drawHeight
                    );
                }
            }
        }
    }

	drawGrid();

    const playersToShow = getAllPlayers();
    players.innerHTML = `Players: ${playersToShow.length}`;

    playersToShow.forEach(player => {
        const [worldX, worldY, name] = player;
        const canvasPos = worldToCanvas(worldX, worldY);
        const isHovered = hoveredPlayer && hoveredPlayer[2] === name;

        const baseRadius = isHovered ? 2.5 : 2;
        const scaleFactor = Math.max(0.3, 1 / Math.pow(currentScale, 0.4));
        const radius = baseRadius * scaleFactor;

        context.fillStyle = getPlayerColour(name);
        context.beginPath();
        context.arc(canvasPos.x, canvasPos.y, radius, 0, Math.PI * 2);
        context.fill();

        context.strokeStyle = isHovered ? 'white' : 'black';
        context.lineWidth = Math.max((isHovered ? 0.7 : 0.4) * scaleFactor, 0.25);
        context.stroke();
    });
}

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
drawScene();