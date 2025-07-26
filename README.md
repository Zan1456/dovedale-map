# Dovedale Live Map

Hosted at [map.dovedale.wiki](https://map.dovedale.wiki), this project aims to provide a near-realtime view of players in [Dovedale Railway](https://play.dovedale.wiki).

Uses Express to host a web server, with Bun as the preferred package manager.

Feel free to have a look through the code or contribute - just make sure you follow general style and document PRs and code changes properly.

## Development

```
bun install
bun dev
```

## Production

```
bun install
bun install pm2 -g
pm2 save
pm2 startup
pm2 start pm2.config.js
```
