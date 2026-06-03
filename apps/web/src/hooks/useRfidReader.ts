import { useState, useCallback, useRef } from 'react';

/** ISO 15693 command bytes for a single-slot inventory (returns UID). */
const INVENTORY_CMD = new Uint8Array([0x26, 0x01, 0x00]);

/** Read single block — 4 bytes of user data at a given block address. */
function buildReadSingleBlockCmd(blockNum: number): Uint8Array {
  return new Uint8Array([0x02, 0x20, 0x60, blockNum]);
}

export type RfidStatus = 'idle' | 'connecting' | 'scanning' | 'read' | 'error';

export interface RfidTag {
  uid: string;
  bookId: string | null;
  copyNumber: number | null;
  rawData: string;
}

interface UseRfidReaderReturn {
  status: RfidStatus;
  tag: RfidTag | null;
  error: string | null;
  isSupported: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  scan: () => Promise<void>;
}

/** Converts Uint8Array to hex string. */
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/**
 * Hook for HF 13.56 MHz ISO 15693 RFID readers via Web USB API.
 * Supports ACR122U and compatible readers. Parses encoded book ID + copy
 * number from the first two 4-byte blocks of the tag's user memory.
 */
export function useRfidReader(): UseRfidReaderReturn {
  const [status, setStatus] = useState<RfidStatus>('idle');
  const [tag, setTag] = useState<RfidTag | null>(null);
  const [error, setError] = useState<string | null>(null);
  const deviceRef = useRef<USBDevice | null>(null);

  const isSupported = typeof navigator !== 'undefined' && 'usb' in navigator;

  const connect = useCallback(async () => {
    if (!isSupported) {
      setError('Web USB is not supported in this browser.');
      setStatus('error');
      return;
    }
    setStatus('connecting');
    setError(null);
    try {
      const device = await navigator.usb.requestDevice({
        filters: [
          { vendorId: 0x072f }, // ACS (ACR122U)
          { vendorId: 0x04e6 }, // SCM Microsystems
          { vendorId: 0x0dc3 }, // Identiv
        ],
      });
      await device.open();
      if (device.configuration === null) await device.selectConfiguration(1);
      await device.claimInterface(0);
      deviceRef.current = device;
      setStatus('idle');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to connect to reader';
      setError(msg);
      setStatus('error');
    }
  }, [isSupported]);

  const disconnect = useCallback(() => {
    const device = deviceRef.current;
    if (device) {
      void device.close().catch(() => undefined);
      deviceRef.current = null;
    }
    setStatus('idle');
    setTag(null);
    setError(null);
  }, []);

  const scan = useCallback(async () => {
    const device = deviceRef.current;
    if (!device) {
      setError('No reader connected. Connect first.');
      setStatus('error');
      return;
    }
    setStatus('scanning');
    setError(null);
    setTag(null);
    try {
      // Send ISO 15693 inventory command
      await device.transferOut(1, INVENTORY_CMD.buffer as ArrayBuffer);
      const inventoryResult = await device.transferIn(1, 64);
      if (!inventoryResult.data || inventoryResult.data.byteLength < 10) {
        throw new Error('No tag found in field');
      }

      // Bytes 2–9 are the 8-byte UID (LSB first for ISO 15693)
      const uidBytes = new Uint8Array(inventoryResult.data.buffer, 2, 8).reverse();
      const uid = toHex(uidBytes);

      // Read block 0 (book ID, 4 bytes) and block 1 (copy number, 4 bytes)
      await device.transferOut(1, buildReadSingleBlockCmd(0).buffer as ArrayBuffer);
      const block0 = await device.transferIn(1, 16);

      await device.transferOut(1, buildReadSingleBlockCmd(1).buffer as ArrayBuffer);
      const block1 = await device.transferIn(1, 16);

      const block0Data = block0.data ? new Uint8Array(block0.data.buffer, 3, 4) : new Uint8Array(4);
      const block1Data = block1.data ? new Uint8Array(block1.data.buffer, 3, 4) : new Uint8Array(4);

      // Block 0: ASCII book ID prefix (4 chars); block 1: 32-bit copy number
      const rawData = toHex(block0Data) + toHex(block1Data);
      const copyView = new DataView(block1Data.buffer, block1Data.byteOffset);
      const copyNumber = copyView.getUint32(0, false);

      // If block 0 is all zeros, tag is blank; otherwise decode as ASCII book ID prefix
      const bookId = block0Data.every((b) => b === 0) ? null : toHex(block0Data);

      setTag({ uid, bookId, copyNumber: copyNumber || null, rawData });
      setStatus('read');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Scan failed';
      setError(msg);
      setStatus('error');
    }
  }, []);

  return { status, tag, error, isSupported, connect, disconnect, scan };
}
