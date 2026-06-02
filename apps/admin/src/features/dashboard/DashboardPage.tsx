import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/auth';

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const ActivityItemSchema = z.object({
  type: z.enum(['checkout', 'return']),
  bookTitle: z.string(),
  userName: z.string(),
  timestamp: z.string(),
});

const DashboardDataSchema = z.object({
  checkoutsToday: z.number(),
  currentlyOverdue: z.number(),
  activeHolds: z.number(),
  booksOutNow: z.number(),
  recentActivity: z.array(ActivityItemSchema).optional(),
});

const ApiResponseSchema = z.object({
  success: z.literal(true),
  data: DashboardDataSchema,
});

type DashboardData = z.infer<typeof DashboardDataSchema>;
type ActivityItem = z.infer<typeof ActivityItemSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/**
 * Fetches dashboard analytics from the API and validates the response shape.
 */
async function fetchDashboardData(token: string | null): Promise<DashboardData> {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api/v1/analytics/dashboard`, { headers });

  if (!res.ok) {
    throw new Error(`Dashboard API returned ${res.status}: ${res.statusText}`);
  }

  const json: unknown = await res.json();
  const parsed = ApiResponseSchema.safeParse(json);

  if (!parsed.success) {
    throw new Error(`Unexpected API response shape: ${parsed.error.message}`);
  }

  return parsed.data.data;
}

/** Formats an ISO timestamp into a human-readable short form. */
function formatTimestamp(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface StatCardProps {
  label: string;
  value: number;
}

function StatCard({ label, value }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16" />
      </CardContent>
    </Card>
  );
}

interface ActivityRowProps {
  item: ActivityItem;
}

function ActivityRow({ item }: ActivityRowProps) {
  return (
    <li className="flex justify-between items-center py-2 border-b last:border-b-0">
      <div className="flex items-center gap-3 min-w-0">
        <Badge variant={item.type === 'checkout' ? 'default' : 'secondary'}>
          {item.type === 'checkout' ? 'Checkout' : 'Return'}
        </Badge>
        <span className="text-sm truncate">
          <span className="font-medium">{item.userName}</span>
          {' — '}
          {item.bookTitle}
        </span>
      </div>
      <span className="text-xs text-muted-foreground shrink-0 ml-4">
        {formatTimestamp(item.timestamp)}
      </span>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/**
 * Admin Dashboard home page — shows circulation stats and recent activity.
 */
export function DashboardPage() {
  const token = useAuthStore((s) => s.accessToken);
  const navigate = useNavigate();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchDashboardData(token);
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load dashboard data.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [token]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Stats row */}
      <section aria-label="Circulation statistics">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : error ? (
            <div
              role="alert"
              className="col-span-full text-sm text-destructive border border-destructive rounded-md p-4"
            >
              {error}
            </div>
          ) : data ? (
            <>
              <StatCard label="Checkouts Today" value={data.checkoutsToday} />
              <StatCard label="Currently Overdue" value={data.currentlyOverdue} />
              <StatCard label="Active Holds" value={data.activeHolds} />
              <StatCard label="Books Out Now" value={data.booksOutNow} />
            </>
          ) : null}
        </div>
      </section>

      {/* Recent activity feed */}
      <section aria-label="Recent activity">
        <h2 className="text-lg font-semibold mb-3">Recent Activity</h2>
        <Card>
          <CardContent className="pt-4">
            {loading ? (
              <div className="space-y-3" aria-label="Loading activity">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : error ? null : !data?.recentActivity || data.recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No recent activity.</p>
            ) : (
              <ul>
                {data.recentActivity.slice(0, 10).map((item, i) => (
                  <ActivityRow key={i} item={item} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Quick actions */}
      <section aria-label="Quick actions">
        <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
        <div className="flex gap-3">
          <Button onClick={() => navigate('/circulation')}>Go to Circulation</Button>
          <Button variant="outline" onClick={() => navigate('/shelving-queue')}>
            Go to Shelving Queue
          </Button>
        </div>
      </section>
    </div>
  );
}
