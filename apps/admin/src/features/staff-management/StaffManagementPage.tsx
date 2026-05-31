import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { PendingTab } from './PendingTab';
import { ActiveStaffTab } from './ActiveStaffTab';

/** Top-level Staff Management page with Pending and Active Staff tabs. */
export function StaffManagementPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Staff Management</h1>
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="active">Active Staff</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="mt-4">
          <PendingTab />
        </TabsContent>
        <TabsContent value="active" className="mt-4">
          <ActiveStaffTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
