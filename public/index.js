const canvas = document.querySelector('canvas');
const players = document.getElementById('players');
const context = canvas.getContext('2d');
const tooltip = document.getElementById('tooltip');
const serverSelect = document.getElementById('server'); // Get the server select element
const TOP_LEFT = { x: -14818, y: -6757 }
const BOTTOM_RIGHT = { x: 13859, y: 6965 }

// Calculate world dimensions
const WORLD_WIDTH = BOTTOM_RIGHT.x - TOP_LEFT.x;
const WORLD_HEIGHT = BOTTOM_RIGHT.y - TOP_LEFT.y;

// Server data tracking
let serverData = {}; // Object to store data for each server
let currentServer = 'all'; // Default to showing all servers
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

// Function to update server list in dropdown - only when servers change
function updateServerList() {
  const currentServers = Object.keys(serverData);

  // Compare current server list with dropdown options
  let needsUpdate = false;

  // Check if number of options (minus All Servers option) matches current servers
  if (serverSelect.options.length - 1 !== currentServers.length) {
    needsUpdate = true;
  } else {
    // Check if each server exists in the dropdown
    for (let i = 0; i < currentServers.length; i++) {
      const serverId = currentServers[i];
      let found = false;

      // Start from index 1 to skip "All Servers" option
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

  // Only update the dropdown if servers have changed
  if (needsUpdate) {
    console.log("Updating server dropdown");

    // Save the currently selected value
    const selectedValue = serverSelect.value;

    // Build new options HTML
    let html = '<option value="all">All Servers</option>';

    // Add an option for each server we've seen
    currentServers.forEach(jobId => {
      // Try to create a readable server name - use last 6 chars of job ID if available
      const serverName = jobId.length > 6 ?
        `Server ${jobId.substring(jobId.length - 6)}` :
        `Server ${jobId}`;

      html += `<option value="${jobId}"${selectedValue === jobId ? ' selected' : ''}>${serverName}</option>`;
    });

    // Update the dropdown HTML
    serverSelect.innerHTML = html;

    // Restore the selected value if it still exists, otherwise default to "all"
    if (selectedValue !== 'all' && !currentServers.includes(selectedValue)) {
      serverSelect.value = 'all';
      currentServer = 'all';
    } else {
      serverSelect.value = selectedValue;
    }
  }
}

canvas.addEventListener('mousemove', (event) => {
  const rect = canvas.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;

  // Check if mouse is over any player
  hoveredPlayer = null;

  // Get all players from the current server or all servers
  const allPlayers = getAllPlayers();

  for (const player of allPlayers) {
    const worldX = player[0];
    const worldY = player[1];
    const name = player[2];
    const serverJobId = player[3]; // Server JobId
    const canvasPos = worldToCanvas(worldX, worldY);

    // Calculate distance from mouse to player
    const distance = Math.sqrt(
      Math.pow(mouseX - canvasPos.x, 2) +
      Math.pow(mouseY - canvasPos.y, 2)
    );

    // If mouse is within 8 pixels of player dot, consider it a hover
    if (distance <= 8) {
      hoveredPlayer = player;
      break;
    }
  }

  // Show/hide tooltip based on hover state
  if (hoveredPlayer) {
    // Show server info alongside player name if viewing all servers
    const playerName = hoveredPlayer[2] || 'Unknown Player';
    const playerServer = hoveredPlayer[3];

    if (currentServer === 'all' && playerServer) {
      const shortServerId = playerServer.length > 6 ?
        playerServer.substring(playerServer.length - 6) :
        playerServer;
      tooltip.textContent = `${playerName} (Server ${shortServerId})`;
    } else {
      tooltip.textContent = playerName;
    }

    tooltip.classList.remove('hidden');
    tooltip.style.left = `${event.clientX + 10}px`;
    tooltip.style.top = `${event.clientY + 10}px`;
  } else {
    tooltip.classList.add('hidden');
  }

  // Redraw scene to highlight hovered player
  drawScene();
});

// Function to get all players for the current server selection
function getAllPlayers() {
  if (currentServer === 'all') {
    // Combine players from all servers
    return Object.values(serverData).flat();
  } else {
    // Return players only from the selected server
    return serverData[currentServer] || [];
  }
}

// Function to convert world coordinates to canvas coordinates
function worldToCanvas(worldX, worldY) {
  // Calculate the relative position (0 to 1) in world space
  const relativeX = (worldX - TOP_LEFT.x) / WORLD_WIDTH;
  const relativeY = (worldY - TOP_LEFT.y) / WORLD_HEIGHT;

  // Convert to canvas pixel coordinates
  return {
    x: relativeX * canvas.width,
    y: relativeY * canvas.height
  };
}

function getPlayerColour(name, serverId) {
  if (!name) return '#00FFFF'; // Default cyan color for unnamed players

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

  // Direct translation of the Lua code
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

  // Calculate the name value following the exact Lua logic
  const nameValue = getNameValue(name);

  // Compute the color index exactly as in Lua
  const colorOffset = 0;
  let colorIndex = ((nameValue + colorOffset) % NAME_COLORS.length);

  // Lua's modulo treats negative results differently than JavaScript
  // This ensures we get the same behavior
  if (colorIndex < 0) {
    colorIndex += NAME_COLORS.length;
  }

  return NAME_COLORS[colorIndex];
}

// Function to draw the entire scene
function drawScene() {
  // Clear the canvas
  context.clearRect(0, 0, canvas.width, canvas.height);

  // Draw the map image if it's loaded
  if (mapLoaded) {
    context.globalAlpha = 1;
    context.drawImage(mapImage, 0, 0, canvas.width, canvas.height);
  } else {
    // If map isn't loaded yet, draw a background grid
    drawGrid();
  }

  // Get players based on current server selection
  const playersToShow = getAllPlayers();

  // Update player count
  players.innerHTML = `Players: ${playersToShow.length}`;

  // Draw each player
  for (const player of playersToShow) {
    const worldX = player[0];
    const worldY = player[1];
    const name = player[2];
    const serverId = player[3];
    const canvasPos = worldToCanvas(worldX, worldY);

    // Check if this is the hovered player
    const isHovered = hoveredPlayer && hoveredPlayer[2] === name &&
      (currentServer === 'all' ? hoveredPlayer[3] === serverId : true);

    // Draw player dot with a small border for better visibility
    context.fillStyle = getPlayerColour(name, serverId);
    context.globalAlpha = 1;

    // Draw slightly larger dot if hovered
    const radius = isHovered ? 5.5 : 4;

    context.beginPath();
    context.arc(canvasPos.x, canvasPos.y, radius, 0, Math.PI * 2);
    context.fill();

    // Add a border to make the dots more visible
    context.strokeStyle = isHovered ? "white" : "black";
    context.lineWidth = isHovered ? 2 : 1;
    context.stroke();
  }
}

// Function to draw the grid (used when map isn't loaded yet)
function drawGrid() {
  context.strokeStyle = '#333333';
  context.lineWidth = 1;
  const gridSize = 500; // World units

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

// Open websocket
const socket = new WebSocket('wss://map.dovedale.wiki/ws');

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

  // Process the data and organize by server
  const newServerData = {};

  for (const player of receivedData) {
    const jobId = player[3] || 'default'; // Use 'default' if no server ID

    if (!newServerData[jobId]) {
      newServerData[jobId] = [];
    }

    newServerData[jobId].push(player);
  }

  // Update our server data
  serverData = newServerData;

  // Update the server selection dropdown
  updateServerList();

  console.log(`Received players from ${Object.keys(serverData).length} server(s), total: ${receivedData.length}`);

  // Draw the scene with the updated data
  drawScene();

  timeout = setTimeout(clearCanvas, 10_000);
};

// Handle connection errors
socket.onerror = (error) => {
  console.error('WebSocket error:', error);
};

// Handle connection close
socket.onclose = () => {
  console.log('WebSocket connection closed');
};

// Handle connection open
socket.onopen = () => {
  console.log('WebSocket connection opened');
};

// Initial draw with empty data
drawScene();

// Handle window resize (optional)
window.addEventListener('resize', () => {
  drawScene();
});


// temporary, please dont abuse this
if (new URLSearchParams(window.location.search).get('key') === 'jaidenSmells') {
  const leversButton = document.getElementById('levers');
  const form = document.getElementById('lever-form');

  leversButton.style.display = 'block';

  leversButton.addEventListener('click', () => {
    const dialog = document.getElementById('dialog');
    dialog.showModal();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const box = document.getElementById('box').value;
    const lever = document.getElementById('lever').value;

    // Send the form data to the server
    socket.send(JSON.stringify({ box, lever }));
  });

  // Handle dialog close
  document.getElementById('dialog').addEventListener('close', () => {
    console.log('Dialog closed');
  });
}
