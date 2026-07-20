import { useState, useCallback, useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { CodeInput } from './CodeInput';
import { TransferProgress, type TransferState } from './TransferProgress';
import {
  createPeerConnection,
  type FileChunk,
} from '../lib/webrtc';
import { FileAssembler } from '../lib/assembler';
import { SignalingClient, type SignalMessage } from '../lib/signaling';

type ReceiveStep = 'code' | 'connecting' | 'transferring' | 'done' | 'error';

export function ReceiveView({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<ReceiveStep>('code');
  const [error, setError] = useState('');
  const [transferState, setTransferState] = useState<TransferState>({
    status: 'connecting',
    percent: 0,
  });

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const signalingRef = useRef<SignalingClient | null>(null);
  const assemblerRef = useRef(new FileAssembler());
  const receivedFilesRef = useRef<string[]>([]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      pcRef.current?.close();
      signalingRef.current?.disconnect();
    };
  }, []);

  const handleCodeSubmit = useCallback(async (enteredCode: string) => {
    setStep('connecting');

    const signaling = new SignalingClient();
    signalingRef.current = signaling;

    try {
      await signaling.connect(enteredCode);
    } catch {
      setError('Failed to connect to signaling server');
      setStep('error');
      return;
    }

    signaling.onMessage(async (msg: SignalMessage) => {
      if ('code' in msg && msg.code !== enteredCode) return;

      switch (msg.type) {
        case 'offer': {
          const { pc } = createPeerConnection(
            (candidate) => {
              signaling.send({
                type: 'ice-candidate',
                code: enteredCode,
                candidate,
              });
            },
            () => {},
            (chunk) => handleChunk(chunk),
            () => handleTransferComplete(),
            (percent) => handleProgress(percent),
          );

          pcRef.current = pc;

          // Handle data channel from sender
          pc.ondatachannel = (event) => {
            const dc = event.channel;
            dc.binaryType = 'arraybuffer';

            dc.onmessage = (event) => {
              if (typeof event.data === 'string') {
                const msg = JSON.parse(event.data);
                if (msg.type === 'transfer-complete') {
                  handleTransferComplete();
                }
              } else {
                const view = new DataView(event.data);
                const headerLen = view.getUint32(0, true);
                const headerBytes = new Uint8Array(event.data, 4, headerLen);
                const header = JSON.parse(new TextDecoder().decode(headerBytes));
                const fileData = event.data.slice(4 + headerLen);

                handleChunk({
                  index: header.index,
                  total: header.total,
                  name: header.name,
                  size: header.size,
                  data: fileData,
                });

                if (header.total > 0) {
                  handleProgress(((header.index + 1) / header.total) * 100);
                }
              }
            };
          };

          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          // Wait for ICE gathering
          await new Promise<void>((resolve) => {
            if (pc.iceGatheringState === 'complete') {
              resolve();
            } else {
              pc.onicegatheringstatechange = () => {
                if (pc.iceGatheringState === 'complete') resolve();
              };
            }
            setTimeout(resolve, 5000);
          });

          signaling.send({
            type: 'answer',
            code: enteredCode,
            sdp: pc.localDescription!,
          });
          break;
        }
        case 'ice-candidate': {
          const pc = pcRef.current;
          if (pc) {
            await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
          }
          break;
        }
      }
    });

    signaling.send({ type: 'join', code: enteredCode, role: 'receiver' });
  }, []);

  const handleChunk = (chunk: FileChunk) => {
    const assembler = assemblerRef.current;
    assembler.addChunk(chunk.name, chunk.size, chunk.index, chunk.total, chunk.data);

    if (!receivedFilesRef.current.includes(chunk.name)) {
      receivedFilesRef.current.push(chunk.name);
    }
  };

  const handleProgress = (percent: number) => {
    setStep('transferring');
    setTransferState({
      status: 'transferring',
      percent,
      connectionType: 'p2p',
      totalFiles: receivedFilesRef.current.length || 1,
    });
  };

  const handleTransferComplete = () => {
    // Download all received files
    for (const fileName of receivedFilesRef.current) {
      assemblerRef.current.assembleAndDownload(fileName);
    }

    setTransferState({ status: 'complete', percent: 100 });
    setStep('done');
  };

  if (step === 'error') {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <p className="text-red-500">{error}</p>
        <button
          onClick={() => {
            setStep('code');
            setError('');
          }}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Try again
        </button>
      </div>
    );
  }

  if (step === 'code') {
    return (
      <div className="flex flex-col gap-6">
        <CodeInput onSubmit={handleCodeSubmit} error={error} />
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

  return (
    <div className="flex flex-col gap-6">
      <TransferProgress
        state={transferState}
        onCancel={() => {
          pcRef.current?.close();
          signalingRef.current?.disconnect();
          setStep('code');
        }}
      />
      {step === 'done' && (
        <button
          onClick={() => {
            setStep('code');
            receivedFilesRef.current = [];
            assemblerRef.current.clear();
          }}
          className="w-full rounded-xl bg-gray-100 px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-200"
        >
          Receive More Files
        </button>
      )}
    </div>
  );
}
