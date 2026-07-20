// Signaling endpoint for WebRTC peer matching
// Deployed as a Cloudflare Pages Function

const rooms = new Map<string, { sender: WebSocket | null; receiver: WebSocket | null }>();

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);

  // CORS
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  // Only handle WebSocket upgrades at /ws
  if (url.pathname !== '/ws') {
    return new Response('Not Found', { status: 404 });
  }

  const code = url.searchParams.get('code');
  if (!code || !/^\d{6}$/.test(code)) {
    return new Response('Invalid code', { status: 400 });
  }

  // Check for WebSocket upgrade
  const upgradeHeader = context.request.headers.get('Upgrade');
  if (!upgradeHeader || upgradeHeader !== 'websocket') {
    return new Response('Expected WebSocket upgrade', { status: 426 });
  }

  // Create WebSocket pair
  const pair = new WebSocketPair();
  const [client, server] = [pair[0], pair[1]];

  server.accept();

  // Get or create room
  if (!rooms.has(code)) {
    rooms.set(code, { sender: null, receiver: null });
  }
  const room = rooms.get(code)!;

  let role: 'sender' | 'receiver' | null = null;

  server.addEventListener('message', (event) => {
    try {
      const msg = JSON.parse(event.data as string);

      // Handle join
      if (msg.type === 'join') {
        role = msg.role;
        if (role === 'sender') {
          room.sender = server;
          // If receiver is already waiting, notify sender
          if (room.receiver) {
            server.send(JSON.stringify({ type: 'ready', code }));
          }
        } else {
          room.receiver = server;
          // If sender is already waiting, notify sender
          if (room.sender) {
            room.sender.send(JSON.stringify({ type: 'ready', code }));
          }
        }
        return;
      }

      // Forward messages to the other peer
      if (role === 'sender' && room.receiver) {
        room.receiver.send(event.data as string);
      } else if (role === 'receiver' && room.sender) {
        room.sender.send(event.data as string);
      }
    } catch {
      // ignore parse errors
    }
  });

  server.addEventListener('close', () => {
    if (role === 'sender') {
      room.sender = null;
      room.receiver?.send(JSON.stringify({ type: 'peer-disconnected' }));
    } else {
      room.receiver = null;
      room.sender?.send(JSON.stringify({ type: 'peer-disconnected' }));
    }
    // Clean up empty rooms after a delay
    setTimeout(() => {
      if (!room.sender && !room.receiver) {
        rooms.delete(code);
      }
    }, 10000);
  });

  server.addEventListener('error', () => {
    if (role === 'sender') room.sender = null;
    else room.receiver = null;
  });

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
};
