import { useState, useRef, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';

interface CodeInputProps {
  onSubmit: (code: string) => void;
  error?: string;
}

export function CodeInput({ onSubmit, error }: CodeInputProps) {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [urlCode, setUrlCode] = useState(false);

  // Check URL for code parameter on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code && /^\d{6}$/.test(code)) {
      const digitsArray = code.split('');
      setDigits(digitsArray);
      setUrlCode(true);
      // Auto-submit after a short delay
      setTimeout(() => onSubmit(code), 500);
    }
  }, [onSubmit]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newDigits = [...digits];
    newDigits[index] = value.slice(-1);
    setDigits(newDigits);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are entered
    const code = newDigits.join('');
    if (code.length === 6 && /^\d{6}$/.test(code)) {
      onSubmit(code);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'Enter') {
      const code = digits.join('');
      if (code.length === 6) onSubmit(code);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(''));
      onSubmit(pasted);
    }
  };

  const code = digits.join('');

  if (urlCode) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
        <p className="text-sm text-gray-500">Connecting...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <p className="text-sm text-gray-500">Enter the 6-digit code from the sender</p>

      <div className="flex gap-2">
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            autoFocus={i === 0}
            className="h-14 w-11 rounded-xl border-2 border-gray-200 bg-white text-center font-mono text-2xl font-bold text-gray-900 outline-none transition-colors focus:border-indigo-500 sm:h-16 sm:w-12 sm:text-3xl"
          />
        ))}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        onClick={() => code.length === 6 && onSubmit(code)}
        disabled={code.length < 6}
        className="flex items-center gap-2 rounded-xl bg-indigo-600 px-8 py-3 text-base font-semibold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 disabled:opacity-50 disabled:shadow-none"
      >
        Receive Files
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}
