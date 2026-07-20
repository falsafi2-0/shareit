import { useState, useCallback, useEffect, useRef } from 'react';
import { Send, ArrowLeft, Loader2 } from 'lucide-react';
import { FilePicker } from './FilePicker';
import { CodeDisplay } from './CodeDisplay';
import { TransferProgress, type TransferState } from './TransferProgress';
import { generateCode } from '../lib/code';
import {
  createPeerConnection,
  createDataChannel,
  sendFileChunk,
  sendTransferComplete,
} from '../lib/webrtc';
import { SignalingClient, type SignalMessage } from '../lib/signaling';

const CHUNK_SIZE = 16384;

type SendStep = 'select' | 'code' | 'transferring' | 'done' | 'error';

export function SendView({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<SendStep>('select');
  const [files, setFiles] = useState<File[]>([]);
  const [code, setCode] = useState('');
  const [transferState, setTransferState] = useState<TransferState>({
    status: 'connecting',
    percent: 0,
  });
  const [error, setError] = useState('');

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const signalingRef = useRef<SignalingClient | null>(null);
  const filesRef = useRef<File[]>([]);

  useEffect(() => {
    return () => {
      dcRef.current?.close();
      pcRef.current?.close();
      signalingRef.current?.disconnect();
    };
  }, []);

  const startTransfer = useCallback(async (dc: RTCDataChannel, transferFiles: File[]) => {
    setStep('transferring');
    setTransferState({ status: 'transferring', percent: 0, connectionType: 'p2p' });

    const totalChunks = transferFiles.reduce(
      (sum, f) => sum + Math.ceil(f.size / CHUNK_SIZE),
      0,
    );
    let sentChunks = 0;
    const startTime = Date.now();

    for (const file of transferFiles) {
      const numChunks = Math.ceil(file.size / CHUNK_SIZE);
      for (let i = 0; i < numChunks; i++) {
        while (dc.bufferedAmount > dc.bufferedAmountLowThreshold) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }

        await sendFileChunk(dc, file, i, numChunks, CHUNK_SIZE);
        sentChunks++;

        const elapsed = (Date.now() - startTime) / 1000;
        const bytesSent = transferFiles
          .slice(0, transferFiles.indexOf(file))
          .reduce((s, f) => s + f.size, 0) + (i + 1) * CHUNK_SIZE;

        setTransferState({
          status: 'transferring',
          percent: (sentChunks / totalChunks) * 100,
          speed: bytesSent / elapsed,
          connectionType: 'p2p',
          filesReceived: transferFiles.indexOf(file) + 1,
          totalFiles: transferFiles.length,
        });
      }
    }

    sendTransferComplete(dc);
    setTransferState({ status: 'complete', percent: 100 });
    setStep('done');
  }, []);

  const handleSend = useCallback(async () => {
    if (files.length === 0) return;

    filesRef.current = files;
    const generatedCode = generateCode();
    setCode(generatedCode);
    setStep('code');

    const signaling = new SignalingClient();
    signalingRef.current = signaling;

    try {
      await signaling.connect(generatedCode);
    } catch {
      setError('Failed to connect to signaling server');
      setStep('error');
      return;
    }

    signaling.onMessage(async (msg: SignalMessage) => {
      if ('code' in msg && msg.code !== generatedCode) return;

      switch (msg.type) {
        case 'ready': {
          // Create peer connection
          const pc = createPeerConnection((candidate) => {
            signaling.send({
              type: 'ice-candidate',
              code: generatedCode,
              candidate,
            });
          });
          pcRef.current = pc;

          // Create data channel
          const dc = createDataChannel(pc);
          dcRef.current = dc;

          // When data channel opens, start sending files
          dc.onopen = () => {
            console.log('Sender data channel open, starting transfer');
            startTransfer(dc, filesRef.current);
          };

          // Create offer
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          // Wait for ICE gathering
          await new Promise<void>((resolve) => {
            const check = () => {
              if (pc.iceGatheringState === 'complete') {
                resolve();
              }
            };
            pc.onicegatheringstatechange = check;
            check();
            setTimeout(resolve, 5000);
          });

          // Send offer with ICE candidates
          signaling.send({
            type: 'offer',
            code: generatedCode,
            sdp: pc.localDescription!,
          });
          break;
        }
        case 'answer': {
          const pc = pcRef.current;
          if (pc && msg.sdp) {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          }
          break;
        }
        case 'ice-candidate': {
          const pc = pcRef.current;
          if (pc && msg.candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
          }
          break;
        }
      }
    });

    signaling.send({ type: 'join', code: generatedCode, role: 'sender' });
  }, [files, startTransfer]);

  if (step === 'error') {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <p className="text-red-500">{error}</p>
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700">
          Go back
        </button>
      </div>
    );
  }

  if (step === 'select') {
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    return (
      <div className="flex flex-col gap-6">
        <FilePicker
          files={files}
          onFilesSelected={(newFiles) => setFiles((prev) => [...prev, ...newFiles])}
          onRemoveFile={(index) => setFiles((prev) => prev.filter((_, i) => i !== index))}
        />

        {files.length > 0 && (
          <div className="flex items-center justify-between rounded-xl bg-gray-100 px-4 py-2.5 text-sm text-gray-600">
            <span>
              {files.length} file{files.length > 1 ? 's' : ''} selected
            </span>
            <span className="font-medium">
              {totalSize < 1024 * 1024
                ? `${(totalSize / 1024).toFixed(1)} KB`
                : `${(totalSize / (1024 * 1024)).toFixed(1)} MB`}
            </span>
          </div>
        )}

        <button
          onClick={handleSend}
          disabled={files.length === 0}
          className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 disabled:opacity-50 disabled:shadow-none"
        >
          <Send className="h-4 w-4" />
          Generate Code
        </button>

        <button
          onClick={onBack}
          className="flex items-center justify-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>
      </div>
    );
  }

  if (step === 'code') {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
          Waiting for receiver to connect...
        </div>
        <CodeDisplay code={code} />
        <button
          onClick={onBack}
          className="flex items-center justify-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <TransferProgress state={transferState} />
      {step === 'done' && (
        <button
          onClick={() => {
            setFiles([]);
            setStep('select');
          }}
          className="w-full rounded-xl bg-gray-100 px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-200"
        >
          Send More Files
        </button>
      )}
    </div>
  );
}
