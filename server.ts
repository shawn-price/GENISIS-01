import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import { v4 as uuidv4 } from "uuid";

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });
  const PORT = 3000;

  // Track connected users
  const clients = new Map<string, { ws: WebSocket; name: string; id: string }>();

  wss.on("connection", (ws) => {
    const clientId = uuidv4();
    let clientName = `User_${clientId.slice(0, 4)}`;

    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case "join":
            clientName = message.name || clientName;
            clients.set(clientId, { ws, name: clientName, id: clientId });
            broadcast({
              type: "user_list",
              users: Array.from(clients.values()).map(c => ({ id: c.id, name: c.name }))
            });
            break;

          case "chat_message":
            broadcast({
              type: "chat_message",
              from: clientName,
              fromId: clientId,
              text: message.text,
              timestamp: Date.now()
            });
            break;

          case "webrtc_signal":
            // Relay signal to specific target
            const target = clients.get(message.targetId);
            if (target) {
              target.ws.send(JSON.stringify({
                type: "webrtc_signal",
                fromId: clientId,
                signal: message.signal
              }));
            }
            break;
        }
      } catch (err) {
        console.error("Error processing message:", err);
      }
    });

    ws.on("close", () => {
      clients.delete(clientId);
      broadcast({
        type: "user_list",
        users: Array.from(clients.values()).map(c => ({ id: c.id, name: c.name }))
      });
    });
  });

  function broadcast(data: any) {
    const payload = JSON.stringify(data);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
