// Webhook-based website that serves /public and redirects the data recieved on /input to any webhook connections
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();
const expressWs = require('express-ws')(app);
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(bodyParser.json());

let webhooks = [];

async function changeLever(box, lever) {
	console.log(`Changing lever ${lever} in box ${box}`);
	const response = await axios.post(
		'https://apis.roblox.com/messaging-service/v1/universes/4252370517/topics/SignalControl',
		{
			message: JSON.stringify({
				message: {
					box: box,
					number: lever,
				},
				timestamp: Date.now(),
			}),
		},
		{
			headers: {
				'x-api-key': process.env.ROBLOX_API_KEY,
				'Content-Type': 'application/json',
			},
		}
	);

	console.log(`Response status code: ${response.status}`);
}

// Endpoint to register a new webhook
app.ws('/ws', (ws, req) => {
	webhooks.push(ws);
	ws.on('message', async (message) => {
		message = JSON.parse(message);
		if (message.key === 'jaidenIsREALLYOldHonestly' && message.box && message.lever) {
			// await changeLever(message.box, message.lever);
		}
	});
	ws.on('closed', () => {
		webhooks = webhooks.filter((webhook) => webhook !== ws);
	});
});

app.get('/key', (req, res) => {
	res.cookie('key', req.query.key, { maxAge: 900000 });
	res.status(200).send("Set key cookie to the query parameter (not saying it's right)");
});

app.get('/status', (req, res) => {
	res.status(200).send('200 OK');
});

app.post('/positions', (req, res) => {
	const data = req.body;

	webhooks.forEach((ws) => {
		if (ws.readyState === ws.OPEN) {
			try {
				ws.send(JSON.stringify(data));
			} catch (err) {
				console.error('Error sending to WebSocket client:', err);
			}
		}
	});

	res.status(200).send('Data broadcasted to all WebSocket clients.');
});

ws.on('close', () => {
	webhooks = webhooks.filter((webhook) => webhook !== ws);
});

app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});
