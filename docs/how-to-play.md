# How to play

Phase 0 is a shared clock. You create a world, start it, and watch the server advance the tick. Closing the browser leaves the clock running until you pause it or stop the app.

Run these commands from the project folder. Docker Desktop needs to be running.

## Start

```text
docker compose up --build -d
```

The first start builds the site and the server, so it takes longer. Later starts can use:

```text
docker compose up -d
```

Open http://localhost:5173/

The connection panel should say **Connected**. If it stays on Connecting, wait a few seconds and refresh. The server comes up after the database is ready.

## Play

1. Enter a world name. A seed is optional.
2. Click **Create world**. The page shows the world id.
3. Click **Start**. The tick increases about once per second.
4. Click **Pause** to stop the tick. **Resume** continues from the same number.
5. Refresh the page. The same world loads again.
6. Open the site in a second tab, or paste the world id into **World id** and click **Load world**. Both views follow the same tick.

Closing a tab does not pause the world. Another tab, or a later visit, still sees the clock if the server is running.

## Stop

```text
docker compose stop
```

This stops the site, the server, and the database. Saved worlds stay on disk. Every running world is stored paused at its last saved tick.

Start again with:

```text
docker compose up -d
```

`docker compose down -v` deletes the saved worlds. Use that only when you want an empty database.

## If you started the apps with npm

Stop the web and server terminals with Ctrl+C, then stop the database:

```text
docker compose stop db
```

Start that workflow again with:

```text
docker compose up db -d
npm run db:migrate
npm run dev:server
npm run dev:web
```
