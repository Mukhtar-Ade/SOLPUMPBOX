'use client';

import { Wallet, LogOut } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { shortAddress } from '@/lib/format';

export function ConnectButton() {
  const { publicKey, connected, connecting, disconnect } = useWallet();
  const { setVisible } = useWalletModal();

  if (!connected || !publicKey) {
    return (
      <button
        type="button"
        onClick={() => setVisible(true)}
        disabled={connecting}
        className="inline-flex h-10 items-center gap-2 rounded-full bg-pump-green px-4 text-sm font-semibold text-black shadow-[0_0_18px_rgba(20,241,149,0.35)] transition hover:brightness-110 disabled:opacity-60"
      >
        <Wallet className="h-4 w-4" />
        {connecting ? 'Connecting...' : 'Connect wallet'}
      </button>
    );
  }

  return (
    <div className="inline-flex h-10 items-center overflow-hidden rounded-full border border-pump-purple/50 bg-pump-purple/10 text-sm">
      <span className="flex items-center gap-2 px-4 font-mono text-white">
        <span className="h-2 w-2 rounded-full bg-pump-green shadow-[0_0_8px_#14F195]" />
        {shortAddress(publicKey.toBase58())}
      </span>
      <button
        type="button"
        onClick={() => disconnect()}
        aria-label="Disconnect wallet"
        className="flex h-full items-center border-l border-pump-purple/40 px-3 text-white/70 transition hover:bg-pump-purple/20 hover:text-white"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
