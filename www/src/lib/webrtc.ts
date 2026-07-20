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
  onDataChannelOpen: () => void,
  onFileChunk: (chunk: FileChunk) => void,
  onTransferComplete: () => void,
  onProgress?: (percent: number) => void,
): { pc: RTCPeerConnection; dc: RTCDataChannel | null } {
  const pc = new RTCPeerConnection(ICE_SERVERS);
  let dc: RTCDataChannel | null = null;

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      onIceCandidate(event.candidate.toJSON());
    }
  };

  pc.oniceconnectionstatechange = () => {
    console.log('ICE state:', pc.iceConnectionState);
  };

  // For sender: create data channel
  pc.onnegotiationneeded = async () => {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
  };

  // For receiver: handle incoming data channel
  pc.ondatachannel = (event) => {
    dc = event.channel;
    setupDataChannel(dc, onFileChunk, onTransferComplete, onDataChannelOpen, onProgress);
  };

  return { pc, dc };
}

export function createDataChannel(
  pc: RTCPeerConnection,
  label: string = 'file-transfer',
): RTCDataChannel {
  const dc = pc.createDataChannel(label, {
    ordered: true,
  });
  setupDataChannel(dc, () => {}, () => {}, () => {});
  return dc;
}

function setupDataChannel(
  dc: RTCDataChannel,
  onFileChunk: (chunk: FileChunk) => void,
  onTransferComplete: () => void,
  onDataChannelOpen: () => void,
  onProgress?: (percent: number) => void,
) {
  dc.binaryType = 'arraybuffer';

  dc.onopen = () => {
    console.log('Data channel open');
    onDataChannelOpen();
  };

  dc.onmessage = (event) => {
    // First message is metadata (JSON)
    if (typeof event.data === 'string') {
      const msg = JSON.parse(event.data);
      if (msg.type === 'transfer-complete') {
        onTransferComplete();
      }
    } else {
      // Binary data - file chunk header is the first 1024 bytes as JSON
      const view = new DataView(event.data);
      const headerLen = view.getUint32(0, true);
      const headerBytes = new Uint8Array(event.data, 4, headerLen);
      const header = JSON.parse(new TextDecoder().decode(headerBytes));
      const fileData = event.data.slice(4 + headerLen);

      onFileChunk({
        index: header.index,
        total: header.total,
        name: header.name,
        size: header.size,
        data: fileData,
      });

      if (onProgress && header.total > 0) {
        onProgress(((header.index + 1) / header.total) * 100);
      }
    }
  };

  dc.onclose = () => {
    console.log('Data channel closed');
  };
}

// Send file metadata (name, size, chunk count) before file data
export function sendFileMetadata(
  dc: RTCDataChannel,
  file: File,
  totalChunks: number,
) {
  const meta = {
    type: 'file-metadata',
    name: file.name,
    size: file.size,
    totalChunks,
  };
  dc.send(JSON.stringify(meta));
}

// Send a single chunk of a file
export function sendFileChunk(
  dc: RTCDataChannel,
  file: File,
  chunkIndex: number,
  totalChunks: number,
  chunkSize: number,
) {
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
      const headerBuf = new Uint32Array([headerStr.length]);

      // Combine header length + header + data
      const combined = new Uint8Array(4 + headerStr.byteLength + (reader.result as ArrayBuffer).byteLength);
      combined.set(new Uint8Array(headerBuf.buffer), 0);
      combined.set(headerStr, 4);
      combined.set(new Uint8Array(reader.result as ArrayBuffer), 4 + headerStr.byteLength);

      dc.send(combined.buffer);
      resolve();
    };
    reader.readAsArrayBuffer(chunk);
  });
}

export function sendTransferComplete(dc: RTCDataChannel) {
  dc.send(JSON.stringify({ type: 'transfer-complete' }));
}
