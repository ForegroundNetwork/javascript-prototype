import { Blockchain } from './Blockchain.js';

export class RequesterNode {
  constructor(port) {
    this.blockchain = new Blockchain('./storage/', 50, 100);
    this.nodeUrl = `ws://localhost:${port}`;
    this.tokenBalances = {};
    this.connectedClients = new Map();

    this.server = Bun.serve({
      port,
      fetch(req, server) {
        if (server.upgrade(req)) {
          console.log("Upgraded WebSocket connection");
          return;
        }
        return new Response("Only WebSocket connections are allowed.", { status: 400 });
      },
      websocket: {
        open(ws) {
          console.log("New WebSocket connection established");
          const clientId = crypto.randomUUID();
          this.connectedClients.set(clientId, ws);
          ws.clientId = clientId;
        },
        async message(ws, message) {
          try {
            const parsedMessage = JSON.parse(message);
            console.log(`Received message from client ${ws.clientId}:`, parsedMessage);
            this.handleMessage(ws, parsedMessage);
          } catch (err) {
            console.error("Failed to parse message:", message, err);
            ws.send(JSON.stringify({ error: "Invalid message format" }));
          }
        },
        close(ws) {
          console.log(`Client ${ws.clientId} disconnected`);
          this.connectedClients.delete(ws.clientId);
        },
        error(ws, error) {
          console.error(`WebSocket error with client ${ws.clientId}:`, error);
        },
      },
    });

    console.log(`Requester Node running on ws://localhost:${port}`);
  }

  handleMessage(ws, message) {
    const { type, payload } = message;

    switch (type) {
      case "NEW_CHECK_REQUEST":
        this.addCheckRequest(payload.from, payload.candidate);
        break;
      case "TOKEN_TRANSFER":
        this.transferTokens(payload.from, payload.to, payload.amount);
        break;
      default:
        console.error("Unknown message type:", type);
        ws.send(JSON.stringify({ error: "Unknown message type" }));
    }
  }

  addCheckRequest(fromAddress, candidateHash) {
    const checkRequest = {
      fromAddress,
      candidateHash,
      timestamp: Date.now(),
    };

    this.blockchain.addCheckRequest(checkRequest);
    console.log("Background check request added:", checkRequest);

    this.broadcast({
      type: "NEW_CHECK_REQUEST",
      payload: checkRequest,
    });
  }

  transferTokens(fromAddress, toAddress, amount) {
    if (!this.tokenBalances[fromAddress] || this.tokenBalances[fromAddress] < amount) {
      console.error("Insufficient balance for transfer");
      return;
    }

    this.tokenBalances[fromAddress] -= amount;
    this.tokenBalances[toAddress] = (this.tokenBalances[toAddress] || 0) + amount;

    console.log(`Transferred ${amount} FGN from ${fromAddress} to ${toAddress}`);
  }

  broadcast(message) {
    this.connectedClients.forEach((ws) => {
      try {
        ws.send(JSON.stringify(message));
      } catch (err) {
        console.error("Failed to send message to client:", err);
      }
    });
  }
}