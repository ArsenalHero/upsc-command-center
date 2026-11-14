export type MockSaveReceipt = { id: string; status: "running" | "submitted"; sequence: number; testId?: string | null; serverNow?: string };

// Keep one request in flight and only the latest unsent snapshot. Question
// navigation never waits for the network; submit/exit can explicitly flush it.
export function createMockSaveQueue<T extends { sequence: number }>({ save, onSaved, onError, delay = 400 }: {
  save: (snapshot: T) => Promise<MockSaveReceipt>;
  onSaved: (receipt: MockSaveReceipt) => void;
  onError: (error: unknown) => void;
  delay?: number;
}) {
  let pending: T | null = null, inFlight: Promise<void> | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined, disposed = false;
  const clearTimer = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };
  const flush = (): Promise<void> => {
    clearTimer();
    if (disposed) return Promise.resolve();
    if (inFlight) return inFlight;
    inFlight = (async () => {
      while (pending && !disposed) {
        const snapshot = pending; pending = null;
        try {
          const receipt = await save(snapshot);
          if (!disposed) onSaved(receipt);
          if (receipt.status === "submitted") { pending = null; break; }
        } catch (error) {
          // A newer local edit supersedes a failed older snapshot.
          if (!disposed) { pending ??= snapshot; onError(error); }
          throw error;
        }
      }
    })().finally(() => { inFlight = null; });
    return inFlight;
  };
  return {
    enqueue(snapshot: T) {
      if (disposed) return;
      if (!pending || snapshot.sequence > pending.sequence) pending = snapshot;
      clearTimer();
      timer = setTimeout(() => { void flush().catch(() => {}); }, delay);
    },
    flush,
    cancelPending() { clearTimer(); pending = null; },
    dispose() { disposed = true; clearTimer(); pending = null; },
  };
}
