// guys i think vlieren needs to go outside!!
const canvas = document.querySelector('canvas');
const players = document.getElementById('players');
const context = canvas.getContext('2d');
const tooltip = document.getElementById('tooltip');
const trainInfo = document.getElementById('train-info');
const serverSelect = document.getElementById('servers');
const TOP_LEFT = { x: -14818, y: -6757 }
const BOTTOM_RIGHT = { x: 13859, y: 6965 }

const ENABLE_TRAIN_INFO = true;

// Calculate world dimensions
const WORLD_WIDTH = BOTTOM_RIGHT.x - TOP_LEFT.x;
const WORLD_HEIGHT = BOTTOM_RIGHT.y - TOP_LEFT.y;

// Server data tracking
let serverData = {};
let currentServer = 'all';
let hoveredPlayer = null;

// Initialize the canvas and context
context.globalAlpha = 1;

// Load the map image
const mapImage = new Image();
mapImage.src = 'map.webp';
let mapLoaded = false;

mapImage.onload = () => {
  mapLoaded = true;
  console.log('Map image loaded');
  drawScene(); // Initial draw
};

// Setup server selection
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
    console.log("Updating server dropdown");

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
  if (!name) return '#00FFFF'; // default cyan

  const NAME_COLORS = [
    '#FD2943', // Bright red
    '#01A2FF', // Bright blue
    '#02B857', // Earth green
    '#A75EB8', // Bright violet
    '#F58225', // Bright orange
    '#F5CD30', // Bright yellow
    '#E8BAC8', // Light reddish violet
    '#D7C59A'  // Brick yellow
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
  context.clearRect(0, 0, canvas.width, canvas.height);

  if (mapLoaded) {
    context.globalAlpha = 1;
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
    context.globalAlpha = 1;

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
  const gridSize = 500; // world units

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

canvas.addEventListener('mousemove', (event) => {
  const rect = canvas.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;

  hoveredPlayer = null;

  const allPlayers = getAllPlayers();

  for (const player of allPlayers) {
    const worldX = player[0];
    const worldY = player[1];
    const canvasPos = worldToCanvas(worldX, worldY);

    const distance = Math.sqrt(
      Math.pow(mouseX - canvasPos.x, 2) +
      Math.pow(mouseY - canvasPos.y, 2)
    );

    if (distance <= 8) {
      hoveredPlayer = player;
      break;
    }
  }

  if (hoveredPlayer) {
    const playerName = hoveredPlayer[2] || 'Unknown Player';
    const playerServer = hoveredPlayer[3];
    const trainData = Array.isArray(hoveredPlayer[4]) ? hoveredPlayer[4] : null;

    document.querySelector('#player .text-xl').textContent = playerName || 'Unknown';

    if (ENABLE_TRAIN_INFO && trainData && trainData.length >= 4) {
      // document.querySelector('#destination .text-xl').textContent = trainData[0] || 'Unknown';
      // document.querySelector('#train-name .text-xl').textContent = trainData[1] || 'Unknown';
      // document.querySelector('#headcode .text-xl').textContent = trainData[2] || 'Unknown';
      // document.querySelector('#train-class .text-xl').textContent = trainData[3] || 'Unknown';

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
    tooltip.style.left = `${event.clientX + 10}px`;
    tooltip.style.top = `${event.clientY + 10}px`;
  } else {
    tooltip.classList.add('hidden');
  }

  drawScene();
});

// const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
// const socket = new WebSocket(`${protocol}${window.location.hostname}:${window.location.port}/ws`); // pointless cos roblox sends data to the public server
const socket = new WebSocket(`wss://map.dovedale.wiki/ws`);

let timeout;
const clearCanvas = () => {
  console.log('Clearing canvas');
  serverData = {};
  updateServerList();
  drawScene();
};

// Handle incoming messages
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
};

socket.onopen = () => {
  console.log('WebSocket connection opened');
};

drawScene();

window.addEventListener('resize', () => {
  drawScene();
});


// key is checked server side goober
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
