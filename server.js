require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();
const expressWs = require('express-ws')(app);
const PORT = process.env.PORT || 3000;
const ROBLOX_SECRET = process.env.ROBLOX_OTHER_KEY || "TEST";

app.use(express.static('public'));
app.use(bodyParser.json());

let webhooks = [];

async function postToWebhook(message) {
	console.log(`Posting to webhook: ${message}`);
	try {
		await axios.post("https://discord.com/api/webhooks/1394424580789108908/kf0Fta-QfGa22sWn-AeFHJW9sFQQT2R4Ay2xrnYgHZBl8bgtLIh6VKckCuxvQqHQmfT7", {
			content: message // Or whatever payload your webhook expects
		});
		console.log('Message sent to webhook');
	} catch (error) {
		console.error('Error sending message to webhook:', error.message);
	}
}

async function changeLever(box, lever) {
	postToWebhook(`Changing lever ${lever} in box ${box}`);
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
	postToWebhook(`Response status code: ${response.status}`);
}


// Endpoint to register WebSocket clients
app.ws('/ws', (ws, req) => {
	webhooks.push(ws);
	//postToWebhook('New WebSocket client connected');

	ws.on('message', async (message) => {
		message = JSON.parse(message);
		if (message.key === 'jaidenIsREALLYOldHonestly' && message.box && message.lever) {
			// await changeLever(message.box, message.lever);
		}
	});

	ws.on('close', () => {
		//postToWebhook('WebSocket client disconnected');
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

	console.log('Received data from Roblox:', data);

	if (!data.token || data.token !== ROBLOX_SECRET) {
		return res.status(401).send('Unauthorized: Invalid key');
	}

	delete data.token;
	console.log(JSON.stringify(data.players));

	webhooks = webhooks.filter((ws) => {
		if (ws.readyState === ws.OPEN) {
			try {
				ws.send(JSON.stringify(data));
				return true;
			} catch (err) {
				postToWebhook('Error sending to WebSocket client:', err);
			}
		}
		return false;
	});

	res.status(200).send();
});

app.listen(PORT, () => {
	postToWebhook(`Server is running`);
});
