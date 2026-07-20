// Cloudflare Worker: ShareIt Signaling Server
// Uses Durable Objects with WebSocket Hibernation for WebRTC signaling

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

    if (url.pathname === '/') {
      return new Response('ShareIt Signaling Server', { headers: corsHeaders });
    }

    if (url.pathname === '/ws') {
      const code = url.searchParams.get('code');
      if (!code || !/^\d{6}$/.test(code)) {
        return new Response('Invalid code', { status: 400, headers: corsHeaders });
      }

      const upgradeHeader = request.headers.get('Upgrade');
      if (!upgradeHeader || upgradeHeader !== 'websocket') {
        return new Response('Expected WebSocket', { status: 426, headers: corsHeaders });
      }

      const id = env.ROOM.idFromName(code);
      const stub = env.ROOM.get(id);
      return stub.fetch(request);
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};

// Durable Object with WebSocket Hibernation API
export class Room {
  private state: DurableObjectState;
  private connections: Map<WebSocket, string> = new Map();

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    this.state.acceptWebSocket(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer): Promise<void> {
    let msg: any;
    try {
      msg = JSON.parse(data as string);
    } catch {
      return;
    }

    if (msg.type === 'join') {
      this.connections.set(ws, msg.role);

      if (this.connections.size >= 2) {
        for (const [sock, role] of this.connections) {
          if (role === 'sender') {
            sock.send(JSON.stringify({ type: 'ready', code: msg.code }));
          }
        }
      }
      return;
    }

    // Forward all other messages to the other peer
    for (const [sock] of this.connections) {
      if (sock !== ws) {
        sock.send(data as string);
        break;
      }
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    this.connections.delete(ws);
    for (const [sock] of this.connections) {
      sock.send(JSON.stringify({ type: 'peer-disconnected' }));
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    this.connections.delete(ws);
  }
}
