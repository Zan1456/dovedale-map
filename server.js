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
  )

  console.log(`Response status code: ${response.status}`);
}

// Endpoint to register a new webhook
app.ws('/ws', (ws, req) => {
  webhooks.push(ws);
  ws.on('message', async (message) => {
    message = JSON.parse(message);
    if (message.box && message.lever) {
      await changeLever(message.box, message.lever);
    }
  });
  ws.on('closed', () => {
    webhooks = webhooks.filter((webhook) => webhook !== ws);
  });
});

app.get('/status', (req, res) => {
  res.status(200).send('200 OK');
});

// Endpoint to receive data and redirect to webhooks
app.post('/', (req, res) => {

  const data = req.body;
  // console.log(`Sending data to websocket(s)`);
  for (const webhook of webhooks) {
    webhook.send(JSON.stringify(data));
  }
  res.status(200).send('Data received and forwarded to webhooks.');
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
