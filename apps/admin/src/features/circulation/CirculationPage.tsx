import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { useBarcodeInput } from '@/hooks/useBarcodeInput';
import { api } from '@/lib/api';

interface CopyResult {
  copy: {
    id: string;
    barcode: string;
    copyNumber: number | null;
    status: string;
    location: string | null;
  };
  book: {
    title: string;
    author: string;
    isbn: string | null;
    deweyDecimal: string | null;
  };
}

interface TabPanelProps {
  scannedBarcode: string | null;
}

function BookResultCard({ data }: { data: CopyResult }) {
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-lg">{data.book.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="font-medium text-muted-foreground">Author</dt>
          <dd>{data.book.author}</dd>
          <dt className="font-medium text-muted-foreground">ISBN</dt>
          <dd>{data.book.isbn ?? '—'}</dd>
          <dt className="font-medium text-muted-foreground">Call Number</dt>
          <dd>{data.book.deweyDecimal ?? '—'}</dd>
          <dt className="font-medium text-muted-foreground">Barcode</dt>
          <dd>{data.copy.barcode}</dd>
          <dt className="font-medium text-muted-foreground">Copy #</dt>
          <dd>{data.copy.copyNumber ?? '—'}</dd>
          <dt className="font-medium text-muted-foreground">Status</dt>
          <dd className="capitalize">{data.copy.status}</dd>
          <dt className="font-medium text-muted-foreground">Location</dt>
          <dd>{data.copy.location ?? '—'}</dd>
        </dl>
      </CardContent>
    </Card>
  );
}

function ScanTabContent({ scannedBarcode }: TabPanelProps) {
  const [scanning, setScanning] = useState(false);

  const { data, error, isError } = useQuery<CopyResult, Error>({
    queryKey: ['copy-barcode', scannedBarcode],
    queryFn: () => api.get<CopyResult>(`/copies/barcode/${scannedBarcode}`),
    enabled: scannedBarcode !== null && scannedBarcode.length > 0,
    retry: false,
  });

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setScanning((s) => !s)}
        >
          {scanning ? 'Stop Camera' : 'Use Camera'}
        </Button>
        {scannedBarcode && (
          <span className="text-sm text-muted-foreground">
            Last scan: <code className="font-mono">{scannedBarcode}</code>
          </span>
        )}
      </div>

      {scanning && (
        <BarcodeScanner
          onScan={() => setScanning(false)}
          onError={(err) => {
            console.error('Camera error:', err);
            setScanning(false);
          }}
        />
      )}

      {isError && scannedBarcode && (
        <Alert variant="destructive">
          <AlertDescription>
            No book found for barcode: {scannedBarcode}
          </AlertDescription>
        </Alert>
      )}

      {data && <BookResultCard data={data} />}
    </div>
  );
}

/** Circulation Desk page — Checkout and Return tabs with barcode scanning. */
export function CirculationPage() {
  const [checkoutBarcode, setCheckoutBarcode] = useState<string | null>(null);
  const [returnBarcode, setReturnBarcode] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('checkout');

  const handleScan = useCallback(
    (barcode: string) => {
      if (activeTab === 'checkout') {
        setCheckoutBarcode(barcode);
      } else {
        setReturnBarcode(barcode);
      }
    },
    [activeTab]
  );

  useBarcodeInput({ onScan: handleScan });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Circulation Desk</h1>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="checkout">Checkout</TabsTrigger>
          <TabsTrigger value="return">Return</TabsTrigger>
        </TabsList>
        <TabsContent value="checkout">
          <ScanTabContent scannedBarcode={checkoutBarcode} />
        </TabsContent>
        <TabsContent value="return">
          <ScanTabContent scannedBarcode={returnBarcode} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
