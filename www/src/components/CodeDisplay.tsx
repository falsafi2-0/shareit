import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, Share2 } from 'lucide-react';

interface CodeDisplayProps {
  code: string;
  expiresIn?: number;
}

export function CodeDisplay({ code, expiresIn = 600 }: CodeDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(expiresIn);
  const timerRef = useRef<number>(0);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const shareUrl = `${window.location.origin}?code=${code}`;

  const copyCode = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: '4share Code',
          text: `Use code ${code} to receive my files on 4share`,
          url: shareUrl,
        });
      } catch {
        // User cancelled
      }
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <p className="text-sm text-gray-500">Share this code with the receiver</p>

      {/* Large code display */}
      <div className="flex items-center gap-2">
        {code.split('').map((digit, i) => (
          <div
            key={i}
            className="flex h-14 w-11 items-center justify-center rounded-xl bg-gray-900 font-mono text-2xl font-bold text-white shadow-lg sm:h-16 sm:w-12 sm:text-3xl"
          >
            {digit}
          </div>
        ))}
      </div>

      {/* Copy button */}
      <button
        onClick={copyCode}
        className="flex items-center gap-2 rounded-xl bg-gray-100 px-6 py-2.5 text-sm font-medium transition-colors hover:bg-gray-200"
      >
        {copied ? (
          <>
            <Check className="h-4 w-4 text-green-500" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" />
            Copy Code
          </>
        )}
      </button>

      {/* QR Code */}
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <QRCodeSVG value={shareUrl} size={160} level="M" />
      </div>

      {/* Share link + native share */}
      <div className="flex w-full flex-col items-center gap-3">
        <div className="flex w-full items-center gap-2">
          <input
            readOnly
            value={shareUrl}
            className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600"
          />
          {'share' in navigator && (
            <button
              onClick={shareNative}
              className="rounded-xl bg-indigo-100 p-2.5 text-indigo-600 hover:bg-indigo-200"
            >
              <Share2 className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Timer */}
        <p className="text-sm text-gray-400">
          Expires in{' '}
          <span className={`font-mono font-medium ${timeLeft < 60 ? 'text-red-500' : 'text-gray-600'}`}>
            {formatTime(timeLeft)}
          </span>
        </p>
      </div>
    </div>
  );
}
