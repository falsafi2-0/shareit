// WebRTC peer connection management for P2P file transfer

export interface FileChunk {
  index: number;
  total: number;
  name: string;
  size: number;
  data: ArrayBuffer;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export function createPeerConnection(
  onIceCandidate: (candidate: RTCIceCandidateInit) => void,
): RTCPeerConnection {
  const pc = new RTCPeerConnection(ICE_SERVERS);

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      onIceCandidate(event.candidate.toJSON());
    }
  };

  pc.oniceconnectionstatechange = () => {
    console.log('ICE state:', pc.iceConnectionState);
  };

  return pc;
}

export function setupDataChannel(
  dc: RTCDataChannel,
  handlers: {
    onFileChunk: (chunk: FileChunk) => void;
    onTransferComplete: () => void;
    onOpen: () => void;
    onProgress?: (percent: number) => void;
  },
) {
  dc.binaryType = 'arraybuffer';

  dc.onopen = () => {
    console.log('Data channel open');
    handlers.onOpen();
  };

  dc.onmessage = (event) => {
    if (typeof event.data === 'string') {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'transfer-complete') {
          handlers.onTransferComplete();
        }
      } catch {
        // ignore
      }
    } else {
      // Binary: [4 bytes header length][header JSON][file data]
      const view = new DataView(event.data);
      const headerLen = view.getUint32(0, true);
      const headerBytes = new Uint8Array(event.data, 4, headerLen);
      const header = JSON.parse(new TextDecoder().decode(headerBytes));
      const fileData = event.data.slice(4 + headerLen);

      handlers.onFileChunk({
        index: header.index,
        total: header.total,
        name: header.name,
        size: header.size,
        data: fileData,
      });

      if (handlers.onProgress && header.total > 0) {
        handlers.onProgress(((header.index + 1) / header.total) * 100);
      }
    }
  };

  dc.onclose = () => {
    console.log('Data channel closed');
  };
}

export function createDataChannel(pc: RTCPeerConnection): RTCDataChannel {
  return pc.createDataChannel('file-transfer', { ordered: true });
}

// Send a single chunk of a file
export function sendFileChunk(
  dc: RTCDataChannel,
  file: File,
  chunkIndex: number,
  totalChunks: number,
  chunkSize: number,
): Promise<void> {
  const start = chunkIndex * chunkSize;
  const end = Math.min(start + chunkSize, file.size);
  const chunk = file.slice(start, end);

  return new Promise<void>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const header = {
        index: chunkIndex,
        total: totalChunks,
        name: file.name,
        size: file.size,
      };
      const headerStr = new TextEncoder().encode(JSON.stringify(header));
      const headerLenBuf = new Uint32Array([headerStr.length]);

      const combined = new Uint8Array(
        4 + headerStr.byteLength + (reader.result as ArrayBuffer).byteLength,
      );
      combined.set(new Uint8Array(headerLenBuf.buffer), 0);
      combined.set(headerStr, 4);
      combined.set(
        new Uint8Array(reader.result as ArrayBuffer),
        4 + headerStr.byteLength,
      );

      dc.send(combined.buffer);
      resolve();
    };
    reader.readAsArrayBuffer(chunk);
  });
}

export function sendTransferComplete(dc: RTCDataChannel) {
  dc.send(JSON.stringify({ type: 'transfer-complete' }));
}
