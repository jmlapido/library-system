import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { useBarcodeInput } from '@/hooks/useBarcodeInput';
import { api, ApiError } from '@/lib/api';

interface CopyResult {
  copy: { id: string; barcode: string; copyNumber: number | null; status: string; location: string | null };
  book: { title: string; author: string; isbn: string | null; deweyDecimal: string | null };
}

/** Return tab — scan book barcode, view info, confirm return. */
export function ReturnTab() {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [copy, setCopy] = useState<CopyResult | null>(null);
  const [lookupError, setLookupError] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  async function lookupBook(barcode: string) {
    if (!barcode.trim()) return;
    setLookupLoading(true);
    setLookupError('');
    setCopy(null);
    try {
      const result = await api.get<CopyResult>(`/copies/barcode/${barcode}`);
      setCopy(result);
      setCameraOpen(false);
    } catch (err) {
      setLookupError(
        err instanceof ApiError
          ? `No book found for barcode: ${barcode}`
          : 'Failed to look up barcode.'
      );
    } finally {
      setLookupLoading(false);
    }
  }

  const returnMutation = useMutation({
    mutationFn: () => api.post('/circulation/return', { barcode: copy!.copy.barcode }),
  });

  const handleScan = useCallback((barcode: string) => {
    setBarcodeInput(barcode);
    lookupBook(barcode);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useBarcodeInput({ onScan: handleScan });

  function reset() {
    setBarcodeInput('');
    setCopy(null);
    setLookupError('');
    setCameraOpen(false);
    returnMutation.reset();
  }

  if (returnMutation.isSuccess) {
    return (
      <div className="mt-4 space-y-4">
        <Alert>
          <AlertDescription>
            <strong>Return processed.</strong>{' '}
            {copy?.book.title} is now in the shelving queue.
          </AlertDescription>
        </Alert>
        <Button onClick={reset}>Next Return</Button>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4 max-w-lg">
      <div className="space-y-2">
        <Label htmlFor="return-barcode">Book Barcode</Label>
        <div className="flex gap-2">
          <Input
            id="return-barcode"
            placeholder="Scan or type barcode…"
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') lookupBook(barcodeInput); }}
            autoFocus
          />
          <Button
            variant="outline"
            disabled={lookupLoading || !barcodeInput.trim()}
            onClick={() => lookupBook(barcodeInput)}
          >
            {lookupLoading ? '…' : 'Lookup'}
          </Button>
          <Button variant="outline" onClick={() => setCameraOpen((o) => !o)}>
            {cameraOpen ? 'Close' : 'Camera'}
          </Button>
        </div>
        {cameraOpen && (
          <BarcodeScanner
            onScan={(b) => { setBarcodeInput(b); lookupBook(b); }}
            onError={() => setCameraOpen(false)}
          />
        )}
        {lookupError && <p className="text-sm text-destructive">{lookupError}</p>}
      </div>

      {copy && (
        <div className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{copy.book.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Author</dt>
                <dd>{copy.book.author}</dd>
                <dt className="text-muted-foreground">Barcode</dt>
                <dd className="font-mono">{copy.copy.barcode}</dd>
                <dt className="text-muted-foreground">Status</dt>
                <dd><Badge variant="secondary" className="capitalize">{copy.copy.status}</Badge></dd>
                <dt className="text-muted-foreground">Location</dt>
                <dd>{copy.copy.location ?? '—'}</dd>
              </dl>
            </CardContent>
          </Card>

          {returnMutation.isError && (
            <Alert variant="destructive">
              <AlertDescription>
                {returnMutation.error instanceof ApiError
                  ? returnMutation.error.message
                  : 'Return failed. Please try again.'}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={returnMutation.isPending}
              onClick={() => returnMutation.mutate()}
            >
              {returnMutation.isPending ? 'Processing…' : 'Confirm Return'}
            </Button>
            <Button variant="outline" onClick={reset}>Clear</Button>
          </div>
        </div>
      )}
    </div>
  );
}
