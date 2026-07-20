// Signaling server connection for matching senders and receivers
// Connects to Cloudflare Worker signaling server

const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL || 'wss://signaling.example.com';

export type SignalMessage =
  | { type: 'join'; code: string; role: 'sender' | 'receiver' }
  | { type: 'offer'; code: string; sdp: RTCSessionDescriptionInit }
  | { type: 'answer'; code: string; sdp: RTCSessionDescriptionInit }
  | { type: 'ice-candidate'; code: string; candidate: RTCIceCandidateInit }
  | { type: 'ready'; code: string }
  | { type: 'error'; message: string };

type SignalCallback = (msg: SignalMessage) => void;

export class SignalingClient {
  private ws: WebSocket | null = null;
  private callbacks: SignalCallback[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  connect(code?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = code
          ? `${SIGNALING_URL}/ws?code=${code}`
          : SIGNALING_URL;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('Signaling connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data) as SignalMessage;
            this.callbacks.forEach((cb) => cb(msg));
          } catch (e) {
            console.error('Invalid signal message', e);
          }
        };

        this.ws.onclose = () => {
          console.log('Signaling disconnected');
        };

        this.ws.onerror = (err) => {
          console.error('Signaling error', err);
          reject(err);
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  send(msg: SignalMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  onMessage(callback: SignalCallback) {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter((cb) => cb !== callback);
    };
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }
}
