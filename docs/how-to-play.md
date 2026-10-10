# How to play

You create a world, watch the server draw its map, and start a clock. Closing the browser leaves the clock running until you pause it or stop the app.

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

The top bar should say **Connected**, **Protocol 1**, and **Phase 0**. If it stays on Connecting, wait a few seconds and refresh. The server comes up after the database is ready.

## Play

1. Click the world button at the top left. Its label is a dash until a world exists.
2. Choose **Create World**.
3. Enter a name. A seed is optional. Click **Create world**. The map area fills with grass, dirt, sand, and water. The world button shows the seed and the map size, `128×128` unless `WORLD_WIDTH` and `WORLD_HEIGHT` were changed before the world was created.
4. Drag the map to pan. Use the mouse wheel to zoom. The stat cards stay on top of the map.
5. Open **Create World** again to see the world name, id, and seed. Copy the id if you want to load this world in another browser.
6. Click the round play button on the Simulation Timeline, or the play button in the top bar. Time starts at day 1, 00:00, and moves forward about one in-game hour each second. The map does not change while time passes.
7. Click pause to stop it. Play again to continue from the same time. The highlighted transport button shows whether the world is running or paused.
8. Refresh the page. The same world and the same map load again.
9. Open the site in a second tab. Both views follow the same clock and show the same map.
10. Open the world menu and click **Delete Current World**. The loaded world's session, map, tiles, and deposits are deleted. Every open view of that world clears, and a refresh does not bring it back.

The timeline shows the running or paused state, the day and hour, how much of the current day has passed, and how much of a 365-day year has passed. The header shows **Year** and **Day** from that same clock. The browser console also prints the tick and each clock field when they change.

Closing a tab does not pause the world. Another tab, or a later visit, still sees the clock if the server is running.

## Load an existing world

A new visit with no saved world can paste an id into **World id** in the Create World dialog and click **Load world**.

After this browser has opened a world, refresh loads that world automatically. The create and load forms stay hidden while a session is open. The dialog then shows the current world id instead.

A world saved before maps existed opens with the message **This world has no generated map.** Create a new world to generate one.

## What on the page is not live yet

These controls and cards are kept as the future layout. They do not talk to the server:

- Step, and the **1x** speed label
- Notifications, Settings, and the side navigation
- Population, food, wood, stone, animals, and happiness
- Active Tasks, World Status, Selected Item, and Recent Events
- The season line under the header clock, including the fixed time **10:24**

Errors from the server, such as pressing play before a world exists, open a dialog. **OK** closes it.

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

For UI edits without rebuilding the site image, use the live-reload steps in [development.md](development.md).
