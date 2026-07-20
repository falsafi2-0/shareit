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

// Durable Object: Room
// Each room is identified by a 6-digit code and holds sender + receiver WebSockets
export class Room {
  private state: DurableObjectState;
  private sender: WebSocket | null = null;
  private receiver: WebSocket | null = null;

  constructor(state: DurableObjectState, _env: Env) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    server.accept();

    server.addEventListener('message', (event) => {
      this.handleMessage(server, event.data as string);
    });

    server.addEventListener('close', () => {
      if (server === this.sender) {
        this.sender = null;
        this.receiver?.send(JSON.stringify({ type: 'peer-disconnected' }));
      } else if (server === this.receiver) {
        this.receiver = null;
        this.sender?.send(JSON.stringify({ type: 'peer-disconnected' }));
      }
    });

    server.addEventListener('error', () => {
      if (server === this.sender) this.sender = null;
      else if (server === this.receiver) this.receiver = null;
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  private handleMessage(ws: WebSocket, data: string) {
    let msg: any;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }

    if (msg.type === 'join') {
      if (msg.role === 'sender') {
        this.sender = ws;
        // If receiver already waiting, notify sender immediately
        if (this.receiver) {
          ws.send(JSON.stringify({ type: 'ready', code: msg.code }));
        }
      } else if (msg.role === 'receiver') {
        this.receiver = ws;
        // If sender already waiting, notify sender
        if (this.sender) {
          this.sender.send(JSON.stringify({ type: 'ready', code: msg.code }));
        }
      }
      return;
    }

    // Forward all signaling messages to the other peer
    if (ws === this.sender && this.receiver) {
      this.receiver.send(data);
    } else if (ws === this.receiver && this.sender) {
      this.sender.send(data);
    }
  }
}
