import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useReportsData } from './useReportsData';
import type { AdminStats, OverdueItem, PopularBook, InventoryAudit, ActivityDay } from './types';

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className}`} />;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <SkeletonBlock className="h-8 w-48" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-24" />
        ))}
      </div>
      <SkeletonBlock className="h-64" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat cards
// ---------------------------------------------------------------------------

interface StatCardProps {
  label: string;
  value: number;
  highlight?: boolean;
}

function StatCard({ label, value, highlight = false }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-3xl font-bold ${highlight ? 'text-destructive' : ''}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function OverviewStats({ stats }: { stats: AdminStats }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      <StatCard label="Total Books" value={stats.totalBooks} />
      <StatCard label="Total Copies" value={stats.totalCopies} />
      <StatCard label="Active Users" value={stats.totalUsers} />
      <StatCard label="Active Checkouts" value={stats.activeCheckouts} />
      <StatCard label="Overdue" value={stats.overdueCheckouts} highlight={stats.overdueCheckouts > 0} />
      <StatCard label="Holds Waiting" value={stats.holdsWaiting} />
      <StatCard label="Available Copies" value={stats.booksAvailable} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity chart
// ---------------------------------------------------------------------------

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ActivityChart({ activity }: { activity: ActivityDay[] }) {
  const chartData = activity.map((d) => ({ ...d, date: formatDate(d.date) }));

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-base">Activity — Last 30 Days</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="checkouts" stroke="#3b82f6" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="returns" stroke="#22c55e" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Overview tab
// ---------------------------------------------------------------------------

function OverviewTab({
  stats,
  activity,
}: {
  stats: AdminStats;
  activity: ActivityDay[];
}) {
  return (
    <div>
      <OverviewStats stats={stats} />
      <ActivityChart activity={activity} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overdue tab
// ---------------------------------------------------------------------------

function OverdueTab({ items }: { items: OverdueItem[] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Overdue Checkouts</CardTitle>
        <Badge variant={items.length > 0 ? 'destructive' : 'secondary'}>
          {items.length} overdue item{items.length !== 1 ? 's' : ''}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Student</th>
                <th className="pb-2 pr-4 font-medium">Grade</th>
                <th className="pb-2 pr-4 font-medium">Book Title</th>
                <th className="pb-2 pr-4 font-medium">Barcode</th>
                <th className="pb-2 pr-4 font-medium">Checked Out</th>
                <th className="pb-2 pr-4 font-medium">Due Date</th>
                <th className="pb-2 font-medium">Days Overdue</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    No overdue checkouts.
                  </td>
                </tr>
              )}
              {items.map((item) => (
                <tr
                  key={item.checkoutId}
                  className={`border-b last:border-0 ${item.daysOverdue >= 7 ? 'bg-red-50' : ''}`}
                >
                  <td className="py-2 pr-4">{item.userFullName}</td>
                  <td className="py-2 pr-4">{item.userGradeLevel ?? '—'}</td>
                  <td className="py-2 pr-4">{item.bookTitle}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{item.barcode}</td>
                  <td className="py-2 pr-4">{new Date(item.checkedOutAt).toLocaleDateString()}</td>
                  <td className="py-2 pr-4">{new Date(item.dueDate).toLocaleDateString()}</td>
                  <td className={`py-2 font-semibold ${item.daysOverdue >= 7 ? 'text-destructive' : ''}`}>
                    {item.daysOverdue}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Popular books tab
// ---------------------------------------------------------------------------

function PopularBooksTab({ books }: { books: PopularBook[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Most Checked Out Books</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">#</th>
                <th className="pb-2 pr-4 font-medium">Title</th>
                <th className="pb-2 pr-4 font-medium">Author</th>
                <th className="pb-2 pr-4 font-medium">Genre</th>
                <th className="pb-2 pr-4 font-medium">Checkouts</th>
                <th className="pb-2 font-medium">Available</th>
              </tr>
            </thead>
            <tbody>
              {books.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No data yet.
                  </td>
                </tr>
              )}
              {books.map((book, index) => (
                <tr key={book.bookId} className="border-b last:border-0">
                  <td className="py-2 pr-4 text-muted-foreground">{index + 1}</td>
                  <td className="py-2 pr-4 font-medium">{book.title}</td>
                  <td className="py-2 pr-4">{book.author}</td>
                  <td className="py-2 pr-4">{book.genre ?? '—'}</td>
                  <td className="py-2 pr-4 font-semibold">{book.checkoutCount}</td>
                  <td className="py-2">
                    <Badge variant={book.currentlyAvailable ? 'default' : 'secondary'}>
                      {book.currentlyAvailable ? 'Yes' : 'No'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Inventory tab
// ---------------------------------------------------------------------------

function InventoryTab({ inventory }: { inventory: InventoryAudit }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 font-medium">Count</th>
              </tr>
            </thead>
            <tbody>
              {inventory.statusBreakdown.map((row) => (
                <tr key={row.status} className="border-b last:border-0">
                  <td className="py-2 pr-4 capitalize">{row.status.replace(/_/g, ' ')}</td>
                  <td className="py-2 font-semibold">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Lost Copies</CardTitle>
          <Badge variant={inventory.lostCopies.length > 0 ? 'destructive' : 'secondary'}>
            {inventory.lostCopies.length} lost
          </Badge>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Barcode</th>
                <th className="pb-2 pr-4 font-medium">Title</th>
                <th className="pb-2 font-medium">Author</th>
              </tr>
            </thead>
            <tbody>
              {inventory.lostCopies.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-muted-foreground">
                    No lost copies recorded.
                  </td>
                </tr>
              )}
              {inventory.lostCopies.map((copy) => (
                <tr key={copy.copyId} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-mono text-xs">{copy.barcode}</td>
                  <td className="py-2 pr-4">{copy.bookTitle}</td>
                  <td className="py-2">{copy.bookAuthor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

/**
 * ReportsPage — analytics dashboard for library staff.
 * Displays stats overview, overdue checkouts, popular books, and inventory audit.
 */
export function ReportsPage() {
  const { stats, overdue, popular, activity, inventory, isLoading, error } = useReportsData();

  if (isLoading) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">
              Failed to load reports data. Please try refreshing the page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Reports</h1>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="overdue">Overdue</TabsTrigger>
          <TabsTrigger value="popular">Popular Books</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          {stats && <OverviewTab stats={stats} activity={activity} />}
        </TabsContent>

        <TabsContent value="overdue" className="mt-4">
          <OverdueTab items={overdue} />
        </TabsContent>

        <TabsContent value="popular" className="mt-4">
          <PopularBooksTab books={popular} />
        </TabsContent>

        <TabsContent value="inventory" className="mt-4">
          {inventory && <InventoryTab inventory={inventory} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
