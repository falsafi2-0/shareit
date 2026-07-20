// Cloudflare Worker: ShareIt Signaling Server
// Uses Durable Objects to manage WebSocket rooms for WebRTC signaling

export interface Env {
  ROOM: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check
    if (url.pathname === '/') {
      return new Response('ShareIt Signaling Server', { headers: corsHeaders });
    }

    // WebSocket upgrade for signaling
    if (url.pathname === '/ws') {
      const code = url.searchParams.get('code');
      if (!code || !/^\d{6}$/.test(code)) {
        return new Response('Invalid code', { status: 400, headers: corsHeaders });
      }

      // Check for WebSocket upgrade
      const upgradeHeader = request.headers.get('Upgrade');
      if (!upgradeHeader || upgradeHeader !== 'websocket') {
        return new Response('Expected WebSocket', { status: 426, headers: corsHeaders });
      }

      // Get Durable Object for this room
      const id = env.ROOM.idFromName(code);
      const stub = env.ROOM.get(id);

      return stub.fetch(request);
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};

// Durable Object: Room
// Manages WebSocket connections for a single transfer code
export class Room {
  private state: DurableObjectState;
  private connections: Map<WebSocket, string> = new Map(); // ws -> role (sender/receiver)

  constructor(state: DurableObjectState) {
    this.state = state;
    this.state.blockConcurrencyWhile(async () => {
      // Restore state if needed
    });
  }

  async fetch(request: Request): Promise<Response> {
    // Create WebSocket pair
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    server.accept();

    server.addEventListener('message', (event) => {
      this.handleMessage(server, event.data as string);
    });

    server.addEventListener('close', () => {
      this.connections.delete(server);
      // Notify remaining connection
      for (const [ws] of this.connections) {
        ws.send(JSON.stringify({ type: 'peer-disconnected' }));
      }
    });

    server.addEventListener('error', () => {
      this.connections.delete(server);
    });

    // Wait for first message (join)
    const joinPromise = new Promise<void>((resolve) => {
      const handler = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data as string);
          if (msg.type === 'join') {
            this.connections.set(server, msg.role);
            server.removeEventListener('message', handler);
            resolve();
          }
        } catch {
          // ignore
        }
      };
      server.addEventListener('message', handler);
    });

    // Race: join within 5s or timeout
    await Promise.race([
      joinPromise,
      new Promise<void>((resolve) => setTimeout(() => {
        server.close(4000, 'Timeout waiting for join');
        resolve();
      }, 5000)),
    ]);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private handleMessage(sender: WebSocket, data: string) {
    let msg: any;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }

    const senderRole = this.connections.get(sender);
    if (!senderRole) return;

    // Find the other connection
    for (const [ws, role] of this.connections) {
      if (ws !== sender) {
        // Forward the message to the peer
        ws.send(data);
        break;
      }
    }

    // Special handling: if sender is ready and we have both peers, notify sender
    if (senderRole === 'sender' && this.connections.size >= 2) {
      sender.send(JSON.stringify({ type: 'ready', code: msg.code }));
    }
  }
}
