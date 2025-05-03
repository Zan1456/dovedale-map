const canvas = document.querySelector('canvas');
const players = document.getElementById('players');
const context = canvas.getContext('2d');
trackTransforms()
const tooltip = document.getElementById('tooltip');
const serverSelect = document.getElementById('servers');

const TOP_LEFT = { x: -23818, y: -10426 };
const BOTTOM_RIGHT = { x: 20504, y: 11377 };

const mapImageLeft = new Image();
const mapImageRight = new Image();
mapImageLeft.src = '/images/map-left.webp';
mapImageRight.src = '/images/map-right.webp';
let mapLeftLoaded = false;
let mapRightLoaded = false;

mapImageLeft.onload = () => {
	mapLeftLoaded = true;
	if (mapLeftLoaded && mapRightLoaded) {
		const CANVAS_CENTRE = worldToCanvas(WORLD_CENTRE_X, WORLD_CENTRE_Y);
		context.translate(window.innerWidth / 2 - CANVAS_CENTRE.x, window.innerHeight / 2 - CANVAS_CENTRE.y);
		drawScene();
	}
};

mapImageRight.onload = () => {
	mapRightLoaded = true;
	if (mapLeftLoaded && mapRightLoaded) {
		const CANVAS_CENTRE = worldToCanvas(WORLD_CENTRE_X, WORLD_CENTRE_Y);
		context.translate(window.innerWidth / 2 - CANVAS_CENTRE.x, window.innerHeight / 2 - CANVAS_CENTRE.y);
		drawScene();
	}
};

const ENABLE_TRAIN_INFO = false;

const WORLD_WIDTH = BOTTOM_RIGHT.x - TOP_LEFT.x;
const WORLD_HEIGHT = BOTTOM_RIGHT.y - TOP_LEFT.y;
const WORLD_CENTRE_X = (TOP_LEFT.x + BOTTOM_RIGHT.x) / 2;
const WORLD_CENTRE_Y = (TOP_LEFT.y + BOTTOM_RIGHT.y) / 2;

let serverData = {};
let currentServer = 'all';
let hoveredPlayer = null;
let lastX = canvas.width / 2;
let lastY = canvas.height / 2;
let dragStart = null;
let isDragging = false;
let currentScale = 1;

function trackTransforms() {
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	let transform = svg.createSVGMatrix();

	context.getTransform = function () {
		return transform;
	};

	const savedTransforms = [];
	const save = context.save;
	context.save = function () {
		savedTransforms.push(transform.translate(0, 0));
		return save.call(context);
	};

	const restore = context.restore;
	context.restore = function () {
		transform = savedTransforms.pop();
		return restore.call(context);
	};

	const scale = context.scale;
	context.scale = function (sx, sy) {
		transform = transform.scaleNonUniform(sx, sy);
		currentScale *= sx;
		return scale.call(context, sx, sy);
	};

	const translate = context.translate;
	context.translate = function (dx, dy) {
		transform = transform.translate(dx, dy);
		return translate.call(context, dx, dy);
	};

	const point = svg.createSVGPoint();
	context.transformedPoint = function (x, y) {
		point.x = x;
		point.y = y;
		return point.matrixTransform(transform.inverse());
	};
}

serverSelect.innerHTML = '<option value="all">All Servers</option>';
serverSelect.addEventListener('change', function () {
	currentServer = this.value;
	drawScene();
});

function updateServerList() {
	const currentServers = Object.keys(serverData);
	let needsUpdate = false;

	if (serverSelect.options.length - 1 !== currentServers.length) {
		needsUpdate = true;
	} else {
		for (let i = 0; i < currentServers.length; i++) {
			const serverId = currentServers[i];
			let found = false;

			for (let j = 1; j < serverSelect.options.length; j++) {
				if (serverSelect.options[j].value === serverId) {
					found = true;
					break;
				}
			}

			if (!found) {
				needsUpdate = true;
				break;
			}
		}
	}

	if (needsUpdate) {
		const selectedValue = serverSelect.value;
		let html = '<option value="all">All Servers';

		// Add total player count for "All Servers" option
		const totalPlayers = Object.values(serverData).reduce((count, players) => count + players.length, 0);
		html += ` (${totalPlayers})`;
		html += '</option>';

		currentServers.forEach((jobId) => {
			const serverName = jobId.length > 6 ? `Server ${jobId.substring(jobId.length - 6)}` : `Server ${jobId}`;

			// Add player count for this server
			const playerCount = serverData[jobId].length;
			html += `<option value="${jobId}"${selectedValue === jobId ? ' selected' : ''}>${serverName} (${playerCount})</option>`;
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
	if (currentServer === 'all') {
		return Object.values(serverData).flat();
	} else {
		return serverData[currentServer] || [];
	}
}

function worldToCanvas(worldX, worldY) {
	const relativeX = (worldX - TOP_LEFT.x) / WORLD_WIDTH;
	const relativeY = (worldY - TOP_LEFT.y) / WORLD_HEIGHT;

	const mapWidth = mapImageLeft.width + mapImageRight.width;
	const mapHeight = mapImageLeft.height; // Assuming both images have the same height
	const mapAspectRatio = mapWidth / mapHeight;

	const canvasAspectRatio = canvas.width / canvas.height;
	let scaleFactor;
	if (mapAspectRatio > canvasAspectRatio) {
		scaleFactor = canvas.width / mapWidth;
	} else {
		scaleFactor = canvas.height / mapHeight;
	}

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

	function getNameValue(pName) {
		let value = 0;
		for (let index = 1; index <= pName.length; index++) {
			const cValue = pName.charCodeAt(index - 1);
			let reverseIndex = pName.length - index + 1;
			if (pName.length % 2 === 1) {
				reverseIndex = reverseIndex - 1;
			}
			if (reverseIndex % 4 >= 2) {
				value = value - cValue;
			} else {
				value = value + cValue;
			}
		}
		return value;
	}

	const nameValue = getNameValue(name);
	const colorOffset = 0;
	let colorIndex = (nameValue + colorOffset) % NAME_COLORS.length;

	if (colorIndex < 0) {
		colorIndex += NAME_COLORS.length;
	}

	return NAME_COLORS[colorIndex];
}

function drawGrid() {
	context.strokeStyle = '#333333';
	context.lineWidth = 1;
	const gridSize = 500;

	for (let x = TOP_LEFT.x; x <= BOTTOM_RIGHT.x; x += gridSize) {
		const canvasPos = worldToCanvas(x, TOP_LEFT.y);
		const canvasPosBottom = worldToCanvas(x, BOTTOM_RIGHT.y);
		context.beginPath();
		context.moveTo(canvasPos.x, canvasPos.y);
		context.lineTo(canvasPosBottom.x, canvasPosBottom.y);
		context.stroke();
	}

	for (let y = TOP_LEFT.y; y <= BOTTOM_RIGHT.y; y += gridSize) {
		const canvasPos = worldToCanvas(TOP_LEFT.x, y);
		const canvasPosRight = worldToCanvas(BOTTOM_RIGHT.x, y);
		context.beginPath();
		context.moveTo(canvasPos.x, canvasPos.y);
		context.lineTo(canvasPosRight.x, canvasPosRight.y);
		context.stroke();
	}
}

function drawScene() {
	const transformedP1 = context.transformedPoint(0, 0);
	const transformedP2 = context.transformedPoint(canvas.width, canvas.height);
	context.clearRect(transformedP1.x, transformedP1.y, transformedP2.x - transformedP1.x, transformedP2.y - transformedP1.y);

	if (mapLeftLoaded && mapRightLoaded) {
		// Calculate the total map dimensions
		const mapWidth = mapImageLeft.width + mapImageRight.width;
		const mapHeight = mapImageLeft.height; // Assuming both images have the same height
		const mapAspectRatio = mapWidth / mapHeight;

		// Calculate the scaling factor to fit the map within the canvas
		const canvasAspectRatio = canvas.width / canvas.height;
		let scaleFactor;
		if (mapAspectRatio > canvasAspectRatio) {
			// Fit to canvas width
			scaleFactor = canvas.width / mapWidth;
		} else {
			// Fit to canvas height
			scaleFactor = canvas.height / mapHeight;
		}

		// Calculate the scaled dimensions
		const scaledMapWidth = mapWidth * scaleFactor;
		const scaledMapHeight = mapHeight * scaleFactor;

		// Center the map on the canvas
		const offsetX = (canvas.width - scaledMapWidth) / 2;
		const offsetY = (canvas.height - scaledMapHeight) / 2;

		// Draw the left and right halves of the map
		context.drawImage(
			mapImageLeft,
			0,
			0,
			mapImageLeft.width,
			mapImageLeft.height,
			offsetX,
			offsetY,
			mapImageLeft.width * scaleFactor,
			scaledMapHeight
		);
		context.drawImage(
			mapImageRight,
			0,
			0,
			mapImageRight.width,
			mapImageRight.height,
			offsetX + mapImageLeft.width * scaleFactor,
			offsetY,
			mapImageRight.width * scaleFactor,
			scaledMapHeight
		);
	} else {
		drawGrid();
	}

	const playersToShow = getAllPlayers();
	players.innerHTML = `Players: ${playersToShow.length}`;

	for (const player of playersToShow) {
		const worldX = player[0];
		const worldY = player[1];
		const name = player[2];
		const canvasPos = worldToCanvas(worldX, worldY);

		const isHovered = hoveredPlayer && hoveredPlayer[2] === name;

		// New scaling logic
		const baseRadius = isHovered ? 2.5 : 2;
		const scaleFactor = Math.max(0.3, 1 / Math.pow(currentScale, 0.4)); // Use a power of 0.4 for more gradual scaling
		const radius = baseRadius * scaleFactor;

		// Draw the dot
		context.fillStyle = getPlayerColour(name);
		context.beginPath();
		context.arc(canvasPos.x, canvasPos.y, radius, 0, Math.PI * 2);
		context.fill();

		// Draw the outline
		context.strokeStyle = isHovered ? 'white' : 'black';
		const outlineWidth = (isHovered ? 0.7 : 0.4) * scaleFactor;
		context.lineWidth = Math.max(outlineWidth, 0.25);
		context.stroke();
	}
}

function updateHoveredPlayer(clientX, clientY) {
	const rect = canvas.getBoundingClientRect();
	const mouseX = clientX - rect.left;
	const mouseY = clientY - rect.top;

	const transformedPoint = context.transformedPoint(mouseX, mouseY);

	const wasHoveredPlayer = !!hoveredPlayer;
	hoveredPlayer = null;
	const allPlayers = getAllPlayers();
	const hoverRadius = 3 / Math.sqrt(currentScale);

	for (const player of allPlayers) {
		const worldX = player[0];
		const worldY = player[1];
		const canvasPos = worldToCanvas(worldX, worldY);

		const distance = Math.sqrt(Math.pow(transformedPoint.x - canvasPos.x, 2) + Math.pow(transformedPoint.y - canvasPos.y, 2));

		if (distance <= hoverRadius) {
			hoveredPlayer = player;
			drawScene();
			break;
		}
	}

	if (!hoveredPlayer && wasHoveredPlayer) drawScene();

	updateTooltip(clientX, clientY);
}

function updateTooltip(clientX, clientY) {
	if (hoveredPlayer) {
		const playerName = hoveredPlayer[2] || 'Unknown Player';
		const playerServer = hoveredPlayer[3];
		const trainData = Array.isArray(hoveredPlayer[4]) ? hoveredPlayer[4] : null;

		document.querySelector('#player .text-xl').textContent = playerName || 'Unknown';

		if (ENABLE_TRAIN_INFO && trainData && trainData.length >= 4) {
			document.querySelectorAll('#tooltip > div').forEach((div) => {
				div.classList.remove('hidden');
			});
		} else {
			document.querySelectorAll('#tooltip > div:not(#player):not(#server)').forEach((div) => {
				div.classList.add('hidden');
			});
		}

		if (currentServer === 'all' && typeof playerServer === 'string' && Object.keys(serverData).length !== 1) {
			const shortServerId = playerServer.length > 6 ? playerServer.substring(playerServer.length - 6) : playerServer;

			document.querySelector('#server .text-xl').textContent = `${shortServerId}`;
			document.querySelector('#server').classList.remove('hidden');
		} else {
			document.querySelector('#server').classList.add('hidden');
		}

		tooltip.classList.remove('hidden');
		tooltip.style.left = `${clientX + 10}px`;
		tooltip.style.top = `${clientY + 10}px`;
	} else {
		tooltip.classList.add('hidden');
	}
}

const scaleFactor = 1.1;

function zoom(clicks, centerX, centerY) {
	const factor = Math.pow(scaleFactor, clicks);
	const pt = context.transformedPoint(centerX, centerY);
	context.translate(pt.x, pt.y);
	context.scale(factor, factor);
	context.translate(-pt.x, -pt.y);
	drawScene();
}

canvas.addEventListener('mousedown', function (event) {
	lastX = event.offsetX;
	lastY = event.offsetY;
	dragStart = context.transformedPoint(lastX, lastY);
	isDragging = false;
});

canvas.addEventListener('mousemove', function (event) {
	lastX = event.offsetX;
	lastY = event.offsetY;

	if (dragStart) {
		isDragging = true;
		const point = context.transformedPoint(lastX, lastY);
		context.translate(point.x - dragStart.x, point.y - dragStart.y);
		drawScene();
	}

	updateHoveredPlayer(event.clientX, event.clientY);
});

canvas.addEventListener('mouseup', function (event) {
	if (!isDragging && dragStart) {
		zoom(event.shiftKey ? -1 : 1, lastX, lastY);
	}
	dragStart = null;
});

canvas.addEventListener('wheel', function (event) {
	const delta = event.deltaY > 0 ? -1 : 1;
	zoom(delta, event.offsetX, event.offsetY);
	event.preventDefault();
});

// Add touch support for mobile devices
let touchStartX, touchStartY;
let lastTouchDistance = 0;

canvas.addEventListener('touchstart', function (event) {
	if (event.touches.length === 1) {
		const touch = event.touches[0];
		touchStartX = touch.clientX;
		touchStartY = touch.clientY;
		lastX = touch.clientX - canvas.getBoundingClientRect().left;
		lastY = touch.clientY - canvas.getBoundingClientRect().top;
		dragStart = context.transformedPoint(lastX, lastY);
		isDragging = false;
	} else if (event.touches.length === 2) {
		// For pinch-to-zoom
		const touch1 = event.touches[0];
		const touch2 = event.touches[1];
		lastTouchDistance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
	}
	event.preventDefault();
});

canvas.addEventListener('touchmove', function (event) {
	if (event.touches.length === 1 && dragStart) {
		const touch = event.touches[0];
		isDragging = true;
		lastX = touch.clientX - canvas.getBoundingClientRect().left;
		lastY = touch.clientY - canvas.getBoundingClientRect().top;
		const point = context.transformedPoint(lastX, lastY);
		context.translate(point.x - dragStart.x, point.y - dragStart.y);
		drawScene();
	} else if (event.touches.length === 2) {
		// Handle pinch-to-zoom
		const touch1 = event.touches[0];
		const touch2 = event.touches[1];
		const currentDistance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);

		if (lastTouchDistance > 0) {
			const delta = currentDistance > lastTouchDistance ? 1 : -1;
			const centerX = (touch1.clientX + touch2.clientX) / 2 - canvas.getBoundingClientRect().left;
			const centerY = (touch1.clientY + touch2.clientY) / 2 - canvas.getBoundingClientRect().top;
			zoom(delta, centerX, centerY);
		}

		lastTouchDistance = currentDistance;
	}

	// Update tooltip for the touch position
	if (event.touches.length === 1) {
		const touch = event.touches[0];
		updateHoveredPlayer(touch.clientX, touch.clientY);
	}

	event.preventDefault();
});

canvas.addEventListener('touchend', function (event) {
	dragStart = null;
	lastTouchDistance = 0;
	event.preventDefault();
});

// Add active state handling for mobile
canvas.addEventListener('touchend', function (event) {
	// If it was a tap (not a drag), show tooltip
	if (!isDragging && event.changedTouches.length === 1) {
		const touch = event.changedTouches[0];
		updateHoveredPlayer(touch.clientX, touch.clientY);
	}
	dragStart = null;
	lastTouchDistance = 0;
	event.preventDefault();
});

// Update hover hint text for mobile
const hoverHint = document.getElementById('hover-hint');
if ('ontouchstart' in window) {
	hoverHint.textContent = "Tap on a dot to see the player's name";
}

const socket = new WebSocket(`wss://map.dovedale.wiki/ws`);

let timeout;
function clearCanvas() {
	serverData = {};
	updateServerList();
	drawScene();
}

socket.onmessage = (event) => {
	timeout && clearTimeout(timeout);
	const receivedData = JSON.parse(event.data);

	const type = receivedData.shift();

	if (type === 'positions') {
		const jobId = receivedData.shift();

		if (!serverData[jobId]) {
			serverData[jobId] = [];
		}

		serverData[jobId] = receivedData;
		updateServerList();
		drawScene();
		timeout = setTimeout(clearCanvas, 10_000);
	}
};

socket.onerror = (error) => {
	console.error('WebSocket error:', error);
};

socket.onclose = () => {
	console.log('WebSocket connection closed');
	setTimeout(() => {
		window.location.reload();
	}, 1000);
};

socket.onopen = () => {
	console.log('WebSocket connection opened');
};

drawScene();

window.addEventListener('resize', () => {
	// Make canvas responsive to window size
	resizeCanvas();
	drawScene();
});

function resizeCanvas() {
	const transformBeforeResize = context.getTransform();

	if (window.innerWidth < 640) {
		canvas.style.position = 'relative';
		canvas.style.zIndex = '0';
	} else {
		canvas.style.position = '';
		canvas.style.zIndex = '';
	}

	context.setTransform(transformBeforeResize.a, transformBeforeResize.b, transformBeforeResize.c, transformBeforeResize.d, transformBeforeResize.e, transformBeforeResize.f);
}

// Initial canvas resize
resizeCanvas();

// Add click handlers for mobile zoom buttons
const zoomInButton = document.getElementById('zoom-in');
const zoomOutButton = document.getElementById('zoom-out');

if (zoomInButton && zoomOutButton) {
	zoomInButton.addEventListener('click', function () {
		const centerX = canvas.width / 2;
		const centerY = canvas.height / 2;
		zoom(1, centerX, centerY);
	});

	zoomOutButton.addEventListener('click', function () {
		const centerX = canvas.width / 2;
		const centerY = canvas.height / 2;
		zoom(-1, centerX, centerY);
	});
}

const params = new URLSearchParams(window.location.search);
if (params.get('levers') === 'true') {
	const leversButton = document.getElementById('levers');
	const form = document.getElementById('lever-form');
	const key = document.cookie.match(/key=([^;]+)/)?.[1];

	leversButton.style.display = 'block';

	leversButton.addEventListener('click', () => {
		const dialog = document.getElementById('dialog');
		dialog.showModal();
		dialog.classList.remove('hidden');
	});

	form.addEventListener('submit', (event) => {
		event.preventDefault();
		const box = document.getElementById('box').value;
		const lever = document.getElementById('lever').value;

		socket.send(JSON.stringify({ box, lever, key }));
	});

	dialog.addEventListener('close', () => {
		dialog.classList.add('hidden');
	});
}

// if in iframe then pop-out button is shown
if (window.self !== window.top) {
	const popOutButton = document.getElementById('pop-out');
	const hoverHint = document.getElementById('hover-hint');
	popOutButton.classList.remove('hidden');
	hoverHint.classList.add('hidden');
	hoverHint.classList.remove('sm:block');
}

drawScene();
