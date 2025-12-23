'use client';

import { useEffect, useState } from 'react';
import Modal from './ui/Modal';

interface TimerProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_SECONDS = 3;

export default function LoadingModal({ isOpen, onClose }: TimerProps) {
  const [remaining, setRemaining] = useState(DEFAULT_SECONDS);

  useEffect(() => {
    if (!isOpen) return;
    setRemaining(DEFAULT_SECONDS);

    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="">
      <p className="text-2xl text-muted">Loading {remaining}...</p>
    </Modal>
  );
}
