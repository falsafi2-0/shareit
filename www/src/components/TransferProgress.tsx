import { useEffect, useState } from 'react';
import { CheckCircle2, Download, AlertCircle, Wifi, WifiOff } from 'lucide-react';

export interface TransferState {
  status: 'connecting' | 'transferring' | 'complete' | 'error';
  percent: number;
  speed?: number; // bytes per second
  filesReceived?: number;
  totalFiles?: number;
  errorMessage?: string;
  connectionType?: 'p2p' | 'cloud';
}

interface TransferProgressProps {
  state: TransferState;
  onCancel?: () => void;
  fileName?: string;
}

export function TransferProgress({ state, onCancel, fileName }: TransferProgressProps) {
  const [displayPercent, setDisplayPercent] = useState(0);

  useEffect(() => {
    // Smooth animation
    const diff = state.percent - displayPercent;
    if (Math.abs(diff) < 0.5) {
      setDisplayPercent(state.percent);
    } else {
      const timer = setTimeout(() => {
        setDisplayPercent((prev) => prev + diff * 0.15);
      }, 16);
      return () => clearTimeout(timer);
    }
  }, [state.percent, displayPercent]);

  const formatSpeed = (bytesPerSec: number) => {
    if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`;
    if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
    return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  };

  const statusConfig = {
    connecting: {
      icon: <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />,
      label: 'Establishing connection...',
      color: 'text-indigo-600',
    },
    transferring: {
      icon: state.connectionType === 'p2p' ? <Wifi className="h-5 w-5 text-indigo-600" /> : <Download className="h-5 w-5 text-indigo-600" />,
      label: state.connectionType === 'p2p' ? 'Transferring peer-to-peer' : 'Downloading from cloud',
      color: 'text-indigo-600',
    },
    complete: {
      icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
      label: 'Transfer complete!',
      color: 'text-green-600',
    },
    error: {
      icon: <AlertCircle className="h-5 w-5 text-red-500" />,
      label: state.errorMessage || 'Transfer failed',
      color: 'text-red-600',
    },
  };

  const config = statusConfig[state.status];

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Status indicator */}
      <div className={`flex items-center gap-2 ${config.color}`}>
        {config.icon}
        <span className="text-sm font-medium">{config.label}</span>
      </div>

      {/* Progress bar */}
      <div className="w-full">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-gray-700">
            {fileName || 'Transfer progress'}
          </span>
          <span className="tabular-nums text-gray-500">{Math.round(displayPercent)}%</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              state.status === 'error'
                ? 'bg-red-500'
                : state.status === 'complete'
                ? 'bg-green-500'
                : 'bg-indigo-600'
            }`}
            style={{ width: `${displayPercent}%` }}
          />
        </div>
      </div>

      {/* Speed and size info */}
      {state.status === 'transferring' && state.speed && (
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <WifiOff className="h-3.5 w-3.5" />
            {formatSpeed(state.speed)}
          </span>
          {state.totalFiles && state.totalFiles > 1 && (
            <span>
              {state.filesReceived || 0} / {state.totalFiles} files
            </span>
          )}
        </div>
      )}

      {/* Connection type badge */}
      {state.status === 'transferring' && state.connectionType && (
        <div
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
            state.connectionType === 'p2p'
              ? 'bg-green-100 text-green-700'
              : 'bg-blue-100 text-blue-700'
          }`}
        >
          {state.connectionType === 'p2p' ? (
            <>
              <Wifi className="h-3 w-3" />
              Direct P2P
            </>
          ) : (
            <>
              <Download className="h-3 w-3" />
              Cloud Download
            </>
          )}
        </div>
      )}

      {/* Complete state */}
      {state.status === 'complete' && (
        <p className="text-center text-sm text-gray-500">
          Files saved to your device's downloads folder.
        </p>
      )}

      {/* Cancel button during transfer */}
      {(state.status === 'connecting' || state.status === 'transferring') && onCancel && (
        <button
          onClick={onCancel}
          className="rounded-xl border border-gray-200 px-6 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
