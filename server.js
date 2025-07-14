const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();
const expressWs = require('express-ws')(app);
const PORT = process.env.PORT || 3000;
const ROBLOX_SECRET = process.env.ROBLOX_OTHER_KEY

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

// Endpoint to register WebSocket clients
app.ws('/ws', (ws, req) => {
	webhooks.push(ws);
	console.log('New WebSocket client connected');

	ws.on('message', async (message) => {
		message = JSON.parse(message);
		if (message.key === 'jaidenIsREALLYOldHonestly' && message.box && message.lever) {
			// await changeLever(message.box, message.lever);
		}
	});

	ws.on('close', () => {
		console.log('WebSocket client disconnected');
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

    // Check if the key matches
    if (data.key !== ROBLOX_SECRET) {
        console.log('❌ Invalid key received in /positions');
        return res.status(401).send('Unauthorized: Invalid key');
    }

    // Remove the key before broadcasting (so clients don’t see it)
    delete data.key;

    // Broadcast to all WebSocket clients
    webhooks = webhooks.filter((ws) => {
        if (ws.readyState === ws.OPEN) {
            try {
                ws.send(JSON.stringify(data));
                return true;
            } catch (err) {
                console.error('Error sending to WebSocket client:', err);
            }
        }
        return false;
    });

    console.log('✅ Data from Roblox accepted and broadcasted');
    res.status(200).send('Data broadcasted to all WebSocket clients.');
});

app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});
