const canvas = document.querySelector('canvas');
const players = document.getElementById('players');
const context = canvas.getContext('2d');
const tooltip = document.getElementById('tooltip');
const serverSelect = document.getElementById('servers');
const TOP_LEFT = { x: -14818, y: -6757 }
const BOTTOM_RIGHT = { x: 13859, y: 6965 }

const ENABLE_TRAIN_INFO = false;

const WORLD_WIDTH = BOTTOM_RIGHT.x - TOP_LEFT.x;
const WORLD_HEIGHT = BOTTOM_RIGHT.y - TOP_LEFT.y;

let serverData = {};
let currentServer = 'all';
let hoveredPlayer = null;
let lastX = canvas.width / 2;
let lastY = canvas.height / 2;
let dragStart = null;
let isDragging = false;

function trackTransforms(ctx) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  let transform = svg.createSVGMatrix();

  ctx.getTransform = function () {
    return transform;
  };

  const savedTransforms = [];
  const save = ctx.save;
  ctx.save = function () {
    savedTransforms.push(transform.translate(0, 0));
    return save.call(ctx);
  };

  const restore = ctx.restore;
  ctx.restore = function () {
    transform = savedTransforms.pop();
    return restore.call(ctx);
  };

  const scale = ctx.scale;
  ctx.scale = function (sx, sy) {
    transform = transform.scaleNonUniform(sx, sy);
    return scale.call(ctx, sx, sy);
  };

  const translate = ctx.translate;
  ctx.translate = function (dx, dy) {
    transform = transform.translate(dx, dy);
    return translate.call(ctx, dx, dy);
  };

  const point = svg.createSVGPoint();
  ctx.transformedPoint = function (x, y) {
    point.x = x;
    point.y = y;
    return point.matrixTransform(transform.inverse());
  };
}

trackTransforms(context);

const mapImage = new Image();
mapImage.src = 'map.webp';
let mapLoaded = false;

mapImage.onload = () => {
  mapLoaded = true;
  drawScene();
};

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
    let html = '<option value="all">All Servers</option>';

    currentServers.forEach(jobId => {
      const serverName = jobId.length > 6 ?
        `Server ${jobId.substring(jobId.length - 6)}` :
        `Server ${jobId}`;

      html += `<option value="${jobId}"${selectedValue === jobId ? ' selected' : ''}>${serverName}</option>`;
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

  return {
    x: relativeX * canvas.width,
    y: relativeY * canvas.height
  };
}

function getPlayerColour(name) {
  if (!name) return '#00FFFF';

  const NAME_COLORS = [
    '#FD2943', '#01A2FF', '#02B857', '#A75EB8',
    '#F58225', '#F5CD30', '#E8BAC8', '#D7C59A'
  ];

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
  let colorIndex = ((nameValue + colorOffset) % NAME_COLORS.length);

  if (colorIndex < 0) {
    colorIndex += NAME_COLORS.length;
  }

  return NAME_COLORS[colorIndex];
}

function drawScene() {
  const transformedP1 = context.transformedPoint(0, 0);
  const transformedP2 = context.transformedPoint(canvas.width, canvas.height);
  context.clearRect(transformedP1.x, transformedP1.y, transformedP2.x - transformedP1.x, transformedP2.y - transformedP1.y);

  if (mapLoaded) {
    context.drawImage(mapImage, 0, 0, canvas.width, canvas.height);
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

    context.fillStyle = getPlayerColour(name);
    const radius = isHovered ? 5.5 : 4;

    context.beginPath();
    context.arc(canvasPos.x, canvasPos.y, radius, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = isHovered ? "white" : "black";
    context.lineWidth = isHovered ? 2 : 1;
    context.stroke();
  }
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

function updateHoveredPlayer(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const mouseX = clientX - rect.left;
  const mouseY = clientY - rect.top;

  const transformedPoint = context.transformedPoint(mouseX, mouseY);

  hoveredPlayer = null;
  const allPlayers = getAllPlayers();

  for (const player of allPlayers) {
    const worldX = player[0];
    const worldY = player[1];
    const canvasPos = worldToCanvas(worldX, worldY);

    const distance = Math.sqrt(
      Math.pow(transformedPoint.x - canvasPos.x, 2) +
      Math.pow(transformedPoint.y - canvasPos.y, 2)
    );

    if (distance <= 8) {
      hoveredPlayer = player;
      break;
    }
  }

  updateTooltip(clientX, clientY);
}

function updateTooltip(clientX, clientY) {
  if (hoveredPlayer) {
    const playerName = hoveredPlayer[2] || 'Unknown Player';
    const playerServer = hoveredPlayer[3];
    const trainData = Array.isArray(hoveredPlayer[4]) ? hoveredPlayer[4] : null;

    document.querySelector('#player .text-xl').textContent = playerName || 'Unknown';

    if (ENABLE_TRAIN_INFO && trainData && trainData.length >= 4) {
      document.querySelectorAll('#tooltip > div').forEach(div => {
        div.classList.remove('hidden');
      });
    } else {
      document.querySelectorAll('#tooltip > div:not(#player):not(#server)').forEach(div => {
        div.classList.add('hidden');
      });
    }

    if (currentServer === 'all' && typeof playerServer === 'string' && Object.keys(serverData).length !== 1) {
      const shortServerId = playerServer.length > 6 ?
        playerServer.substring(playerServer.length - 6) :
        playerServer;

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

  const jobId = receivedData.shift() || '???';

  if (!serverData[jobId]) {
    serverData[jobId] = [];
  }

  serverData[jobId] = receivedData;
  updateServerList();
  drawScene();
  timeout = setTimeout(clearCanvas, 10_000);
};

socket.onerror = (error) => {
  console.error('WebSocket error:', error);
};

socket.onclose = () => {
  console.log('WebSocket connection closed');
  setTimeout(window.location.reload, 800);
};

socket.onopen = () => {
  console.log('WebSocket connection opened');
};

drawScene();

window.addEventListener('resize', () => {
  drawScene();
});

// drop a like if you think vlieren needs to go outside
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

drawScene();
