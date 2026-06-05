import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckoutTab } from './CheckoutTab';
import { ReturnTab } from './ReturnTab';

/** Circulation Desk — Checkout and Return tabs. */
export function CirculationPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Circulation Desk</h1>
      <Tabs defaultValue="checkout">
        <TabsList>
          <TabsTrigger value="checkout">Checkout</TabsTrigger>
          <TabsTrigger value="return">Return</TabsTrigger>
        </TabsList>
        <TabsContent value="checkout">
          <CheckoutTab />
        </TabsContent>
        <TabsContent value="return">
          <ReturnTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
