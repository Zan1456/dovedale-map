const canvas = document.querySelector('canvas');
const players = document.getElementById('players');
const context = canvas.getContext('2d');
const tooltip = document.getElementById('tooltip');
const serverSelect = document.getElementById('servers');

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
let ws = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 1;
let reconnectTimeout = null;

const TOP_LEFT = { x: -23818, y: -10426 };
const BOTTOM_RIGHT = { x: 20504, y: 11377 };
const WORLD_WIDTH = BOTTOM_RIGHT.x - TOP_LEFT.x;
const WORLD_HEIGHT = BOTTOM_RIGHT.y - TOP_LEFT.y;
const WORLD_CENTRE_X = (TOP_LEFT.x + BOTTOM_RIGHT.x) / 2;
const WORLD_CENTRE_Y = (TOP_LEFT.y + BOTTOM_RIGHT.y) / 2;
const ENABLE_TRAIN_INFO = false;

const MAP_CONFIG = {
	rows: 1,
	cols: 16,
	totalWidth: 28680,
	totalHeight: 13724
};

const mapImages = [];
let loadedImages = 0;
const totalImages = MAP_CONFIG.rows * MAP_CONFIG.cols;
const connectionPopup = document.getElementById('connectionPopup');
const reconnectBtn = document.getElementById('reconnectBtn');

for (let row = 0; row < MAP_CONFIG.rows; row++) {
	mapImages[row] = [];
	for (let col = 0; col < MAP_CONFIG.cols; col++) {
		const img = new Image();

		img.src = `/images/row-${row + 1}-column-${col + 1}.png`;

		img.onload = () => {
			loadedImages++;
			if (loadedImages === 1) {
				initializeMap();
			} else {
				drawScene();
			}
		};

		img.onerror = () => {
			console.error(`Failed to load image: ${img.src}`);
			loadedImages++;
			drawScene();
		};

		mapImages[row][col] = img;
	}
}

trackTransforms();
initializeMap();

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

function initializeMap() {
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;

	const CANVAS_CENTRE = worldToCanvas(WORLD_CENTRE_X, WORLD_CENTRE_Y);
	context.translate(window.innerWidth / 2 - CANVAS_CENTRE.x, window.innerHeight / 2 - CANVAS_CENTRE.y);
	drawScene();
}

canvas.addEventListener('mousedown', (event) => {
	const mousePos = getCanvasCoordinates(event);
	dragStart = context.transformedPoint(mousePos.x, mousePos.y);
	isDragging = true;
});

canvas.addEventListener('mousemove', (event) => {
	if (isDragging) {
		if (hoveredPlayer) {
			hoveredPlayer = null;
			tooltip.classList.add('hidden');
		}

		const mousePos = getCanvasCoordinates(event);
		const currentPoint = context.transformedPoint(mousePos.x, mousePos.y);
		const dx = currentPoint.x - dragStart.x;
		const dy = currentPoint.y - dragStart.y;

		context.translate(dx, dy);
		drawScene();
	} else {
		const mousePos = getCanvasCoordinates(event);
		const player = getPlayerAtPosition(mousePos.x, mousePos.y);

		if (player !== hoveredPlayer) {
			hoveredPlayer = player;

			updateTooltip(player, event.clientX, event.clientY);

			drawScene();
		}
	}
});

function updateReconnectButton() {
	if (reconnectAttempts >= maxReconnectAttempts) {
		reconnectBtn.innerHTML = 'Reconnect';
		reconnectBtn.disabled = false;
		reconnectBtn.classList.remove('connecting');
	}
}

reconnectBtn.addEventListener('click', () => {
	if (reconnectAttempts >= maxReconnectAttempts) {
		reconnectAttempts = 0;
	}
	attemptReconnect();
});

canvas.addEventListener('mouseleave', () => {
	isDragging = false;
	dragStart = null;

	if (hoveredPlayer) {
		hoveredPlayer = null;
		tooltip.classList.add('hidden');
		drawScene();
	}
});

canvas.addEventListener('mouseup', () => {
	isDragging = false;
	dragStart = null;
});

canvas.addEventListener('wheel', (event) => {
	event.preventDefault();
	const zoomIntensity = 0.1;
	const scale = event.deltaY < 0 ? 1 + zoomIntensity : 1 - zoomIntensity;
	const mousePos = getCanvasCoordinates(event);

	zoomAt(mousePos.x, mousePos.y, scale);
}, { passive: false });

canvas.addEventListener('touchstart', (event) => {
	hoveredPlayer = null;
	tooltip.classList.add('hidden');

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

	hoveredPlayer = null;
	tooltip.classList.add('hidden');

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

canvas.addEventListener('touchend', (event) => {
	if (event.touches.length < 2) lastTouchDistance = 0;
	if (event.touches.length === 0) {
		isDragging = false;
		dragStart = null;
	}
});

function createWebSocket() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  ws = new WebSocket(`wss://${window.location.host}/ws`);

  ws.addEventListener('open', () => {
    console.log('WebSocket connected');
    reconnectAttempts = 0;
    hideConnectionPopup();
  });

  ws.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(event.data);
      const jobId = data.jobId;
      const playersArray = Array.isArray(data.players) ? data.players : [];

      serverData[jobId] = playersArray;
      updateServerList(data);
      drawScene();
    } catch (err) {
      console.error('Error parsing data', err);
    }
  });

  ws.addEventListener('error', (err) => {
    console.warn('WebSocket error:', err);
	attemptReconnect();
  });

  ws.addEventListener('close', (event) => {
    console.warn('WebSocket closed:', event.code, event.reason);
    showConnectionPopup();	
    
    if (reconnectAttempts < maxReconnectAttempts) {
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
      reconnectTimeout = setTimeout(() => {
        attemptReconnect();
      }, delay);
    }
  });

  return ws;
}

function showConnectionPopup() {
  connectionPopup.classList.remove('hidden');
  updateReconnectButton();
}

function hideConnectionPopup() {
  connectionPopup.classList.add('hidden');
  reconnectBtn.classList.remove('connecting');
  reconnectBtn.disabled = false;
  reconnectBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
      <path d="M21 3v5h-5"/>
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
      <path d="M3 21v-5h5"/>
    </svg>
    Reconnect
  `;
}

function attemptReconnect() {
  if (reconnectAttempts >= maxReconnectAttempts) {
    updateReconnectButton();
    return;
  }

  reconnectAttempts++;
  //console.log(`Reconnect attempt ${reconnectAttempts}/${maxReconnectAttempts}`);
  
  reconnectBtn.classList.add('connecting');
  reconnectBtn.disabled = true;
  reconnectBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
      <path d="M21 3v5h-5"/>
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
      <path d="M3 21v-5h5"/>
    </svg>
    Connecting...
  `;

  if (ws && ws.readyState !== WebSocket.CLOSED) {
    ws.close();
  }

  createWebSocket();
}

reconnectBtn.addEventListener('click', () => {
  if (reconnectAttempts >= maxReconnectAttempts) {
    reconnectAttempts = 0;
  }
  attemptReconnect();
});

function trackTransforms() {
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	let transform = svg.createSVGMatrix();

	context.getTransform = () => transform;

	const savedTransforms = [];
	const originalSave = context.save;
	const originalRestore = context.restore;
	const originalScale = context.scale;
	const originalTranslate = context.translate;

	context.save = function () {
		savedTransforms.push(transform.translate(0, 0));
		return originalSave.call(context);
	};

	context.restore = function () {
		transform = savedTransforms.pop();
		return originalRestore.call(context);
	};

	context.scale = function (sx, sy) {
		transform = transform.scaleNonUniform(sx, sy);
		currentScale *= sx;
		return originalScale.call(context, sx, sy);
	};

	context.translate = function (dx, dy) {
		transform = transform.translate(dx, dy);
		return originalTranslate.call(context, dx, dy);
	};

	const point = svg.createSVGPoint();
	context.transformedPoint = function (x, y) {
		point.x = x;
		point.y = y;
		return point.matrixTransform(transform.inverse());
	};
}

function totalPlayers(players) {
	if (!Array.isArray(players)) {
		console.warn("totalPlayers: players is not an array", players);
		return 0;
	}
	return players.length;
}

function updateServerList(data) {
	const currentServers = Object.keys(serverData);
	const existingServers = Array.from(serverSelect.options).slice(1).map(opt => opt.value);

	const playersArray = data && Array.isArray(data.players) ? data.players : [];

	playersArray.forEach(player => {
		if (player.trainData && !Array.isArray(player.trainData)) {
			const td = player.trainData;
			if (typeof td === 'object' && td !== null) {
				player.trainData = [
					td.destination || "Unknown",
					td.class || "Unknown",
					td.headcode || "----",
					td.headcodeClass || ""
				];
			} else {
				player.trainData = null;
			}
		}
	});

	if (currentServers.length !== existingServers.length ||
		!currentServers.every(server => existingServers.includes(server))) {

		const selectedValue = serverSelect.value;
		const totalPlayersCount = Object.values(serverData).reduce(
			(count, playersArr) => count + (Array.isArray(playersArr) ? playersArr.length : 0),
			0
		);

		let html = `<option value="all">All Servers (${totalPlayersCount})</option>`;

		currentServers.forEach(jobId => {
			const serverName = jobId.length > 6 ? `Server ${jobId.substring(jobId.length - 6)}` : `Server ${jobId}`;
			const playerCount = Array.isArray(serverData[jobId]) ? serverData[jobId].length : 0;
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

serverSelect.addEventListener('change', () => {
	currentServer = serverSelect.value;
	drawScene();
});

function getAllPlayers() {
	return currentServer === 'all' ? Object.values(serverData).flat() : (serverData[currentServer] || []);
}

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

function getPlayerAtPosition(canvasX, canvasY) {
	const playersToCheck = getAllPlayers();

	for (const player of playersToCheck) {
		const worldX = player.position?.x ?? 0;
		const worldY = player.position?.y ?? 0;

		const baseCanvasPos = worldToCanvas(worldX, worldY);

		const transform = context.getTransform();
		const screenX = baseCanvasPos.x * transform.a + baseCanvasPos.y * transform.c + transform.e;
		const screenY = baseCanvasPos.x * transform.b + baseCanvasPos.y * transform.d + transform.f;

		const baseRadius = 3; // Slightly larger than the 2 in drawScene for easier hovering
		const scaleFactor = Math.max(0.3, 1 / Math.pow(currentScale, 0.4));
		const hitRadius = baseRadius * scaleFactor * Math.abs(transform.a); // transform.a contains the scale

		const distance = Math.hypot(screenX - canvasX, screenY - canvasY);

		if (distance <= hitRadius) {
			return player;
		}
	}

	return null;
}

function updateTooltip(player, mouseX, mouseY) {
	if (player) {
		const name = player.username ?? "Unknown";
		const x = Math.round(player.position?.x ?? 0);
		const y = Math.round(player.position?.y ?? 0);

		const playerElement = tooltip.querySelector('#player div');
		if (playerElement) playerElement.textContent = name;

		const destinationSection = tooltip.querySelector('#destination');
		const trainNameSection = tooltip.querySelector('#train-name');
		const headcodeSection = tooltip.querySelector('#headcode');
		const trainClassSection = tooltip.querySelector('#train-class');
		const serverSection = tooltip.querySelector('#server');

		const playerSection = tooltip.querySelector('#player');
		if (playerSection) playerSection.style.display = 'flex';

		if (ENABLE_TRAIN_INFO && player.trainData && Array.isArray(player.trainData)) {
			const [destination, trainClass, headcode] = player.trainData;

			if (destination && destination !== "Unknown" && destinationSection) {
				const destDiv = destinationSection.querySelector('div');
				if (destDiv) destDiv.textContent = destination;
				destinationSection.style.display = 'flex';
			} else if (destinationSection) {
				destinationSection.style.display = 'none';
			}

			if (trainClass && trainClass !== "Unknown" && trainClassSection) {
				const classDiv = trainClassSection.querySelector('div');
				if (classDiv) classDiv.textContent = trainClass;
				trainClassSection.style.display = 'flex';
			} else if (trainClassSection) {
				trainClassSection.style.display = 'none';
			}

			if (headcode && headcode !== "----" && headcodeSection) {
				const headDiv = headcodeSection.querySelector('div');
				if (headDiv) headDiv.textContent = headcode;
				headcodeSection.style.display = 'flex';
			} else if (headcodeSection) {
				headcodeSection.style.display = 'none';
			}

			if (trainNameSection) trainNameSection.style.display = 'none';
		} else {
			if (destinationSection) destinationSection.style.display = 'none';
			if (trainNameSection) trainNameSection.style.display = 'none';
			if (headcodeSection) headcodeSection.style.display = 'none';
			if (trainClassSection) trainClassSection.style.display = 'none';
		}

		if (serverSection && currentServer === 'all') {
			const serverDiv = serverSection.querySelector('div');
			if (serverDiv) {
				const serverName = currentServer.length > 6 ? currentServer.substring(currentServer.length - 6) : currentServer;
				serverDiv.textContent = player.serverName;
			}
			serverSection.style.display = 'flex';
		} else if (serverSection) {
			serverSection.style.display = 'none';
		}

		const worldX = player.position?.x ?? 0;
		const worldY = player.position?.y ?? 0;
		const baseCanvasPos = worldToCanvas(worldX, worldY);

		const transform = context.getTransform();
		const screenX = baseCanvasPos.x * transform.a + baseCanvasPos.y * transform.c + transform.e;
		const screenY = baseCanvasPos.x * transform.b + baseCanvasPos.y * transform.d + transform.f;

		const canvasRect = canvas.getBoundingClientRect();
		const tooltipX = canvasRect.left + screenX;
		const tooltipY = canvasRect.top + screenY;

		let finalX = tooltipX + 15;
		let finalY = tooltipY - 40;

		tooltip.classList.remove('hidden');
		tooltip.style.visibility = 'hidden';

		const tooltipRect = tooltip.getBoundingClientRect();
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;

		if (finalX + tooltipRect.width > viewportWidth) {
			finalX = tooltipX - tooltipRect.width - 15;
		}

		if (finalY < 0) {
			finalY = tooltipY + 20;
		}

		if (finalY + tooltipRect.height > viewportHeight) {
			finalY = tooltipY - tooltipRect.height - 20;
		}

		if (finalX < 0) {
			finalX = tooltipX + 15;
		}

		tooltip.style.left = `${finalX}px`;
		tooltip.style.top = `${finalY}px`;
		tooltip.style.visibility = 'visible';

	} else {
		tooltip.classList.add('hidden');
	}
}

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

	const chunkWidth = mapWidth / MAP_CONFIG.cols;
	const chunkHeight = mapHeight / MAP_CONFIG.rows;
	const scaledChunkWidth = chunkWidth * scaleFactor;
	const scaledChunkHeight = chunkHeight * scaleFactor;

	for (let row = 0; row < MAP_CONFIG.rows; row++) {
		for (let col = 0; col < MAP_CONFIG.cols; col++) {
			const img = mapImages[row][col];
			if (img && img.complete) {
				const destX = offsetX + col * scaledChunkWidth;
				const destY = offsetY + row * scaledChunkHeight;

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

	const playersToShow = getAllPlayers();
	players.innerHTML = `Players: ${playersToShow.length}`;

	playersToShow.forEach(player => {
		// player is like { username: "...", position: { x: ..., y: ... } }
		const worldX = player.position?.x ?? 0;
		const worldY = player.position?.y ?? 0;
		const name = player.username ?? "Unknown";

		const canvasPos = worldToCanvas(worldX, worldY);
		const isHovered = hoveredPlayer && hoveredPlayer?.username === name;

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
serverSelect.innerHTML = '<option value="all">All Servers (0)</option>';
ws = createWebSocket();