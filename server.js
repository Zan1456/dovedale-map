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

async function changeLever(box, lever) {
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
}


app.ws('/ws', (ws, req) => {
	webhooks.push(ws);

	ws.on('message', async (message) => {
		message = JSON.parse(message);
		if (message.key === 'jaidenIsREALLYOldHonestly' && message.box && message.lever) {
		}
	});

	ws.on('close', () => {
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
	
	webhooks = webhooks.filter((ws) => {
		if (ws.readyState === ws.OPEN) {
			try {
				ws.send(JSON.stringify(data));
				return true;
			} catch (err) {
			}
		}
		return false;
	});

	res.status(200).send();
});

app.listen(PORT, () => {
});
