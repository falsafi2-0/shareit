import { useState } from 'react';
import { Header } from './components/Header';
import { SendView } from './components/SendView';
import { ReceiveView } from './components/ReceiveView';
import { Send, Download } from 'lucide-react';

type View = 'home' | 'send' | 'receive';

export default function App() {
  const [view, setView] = useState<View>('home');

  return (
    <div className="mx-auto min-h-screen max-w-lg px-4 pb-12">
      <Header />

      {view === 'home' && (
        <div className="flex flex-col items-center gap-8 pt-16 md:pt-24">
          {/* Hero */}
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              Share files
              <br />
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                instantly
              </span>
            </h1>
            <p className="mt-4 text-lg text-gray-500">
              No signup. No size limits. Just send and receive.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex w-full flex-col gap-3">
            <button
              onClick={() => setView('send')}
              className="flex items-center justify-center gap-3 rounded-2xl bg-indigo-600 px-8 py-5 text-lg font-semibold text-white shadow-xl shadow-indigo-200 transition-all hover:bg-indigo-700 hover:shadow-indigo-300 active:scale-[0.98]"
            >
              <Send className="h-5 w-5" />
              Send Files
            </button>
            <button
              onClick={() => setView('receive')}
              className="flex items-center justify-center gap-3 rounded-2xl border-2 border-gray-200 bg-white px-8 py-5 text-lg font-semibold text-gray-700 transition-all hover:border-indigo-300 hover:bg-indigo-50 active:scale-[0.98]"
            >
              <Download className="h-5 w-5" />
              Receive Files
            </button>
          </div>

          {/* Features */}
          <div className="mt-8 grid w-full grid-cols-3 gap-4 text-center">
            {[
              { title: 'P2P Transfer', desc: 'Direct browser-to-browser' },
              { title: 'No Signup', desc: 'Zero friction' },
              { title: 'Encrypted', desc: 'End-to-end secure' },
            ].map((f) => (
              <div key={f.title} className="rounded-xl bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-gray-900">{f.title}</p>
                <p className="mt-1 text-xs text-gray-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'send' && <SendView onBack={() => setView('home')} />}
      {view === 'receive' && <ReceiveView onBack={() => setView('home')} />}

      {/* Footer */}
      <footer className="mt-auto pt-12 text-center text-xs text-gray-400">
        Built with WebRTC. Files never touch a server.
      </footer>
    </div>
  );
}
