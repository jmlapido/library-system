import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type {
  AdminStats,
  OverdueItem,
  PopularBook,
  ActivityDay,
  InventoryAudit,
} from './types';

/** Fetches all analytics data for the Reports page. */
export function useReportsData() {
  const stats = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get<AdminStats>('/admin/stats'),
  });

  const overdue = useQuery({
    queryKey: ['admin-overdue'],
    queryFn: () => api.get<OverdueItem[]>('/admin/reports/overdue'),
  });

  const popular = useQuery({
    queryKey: ['admin-popular-books'],
    queryFn: () => api.get<PopularBook[]>('/admin/reports/popular'),
  });

  const activity = useQuery({
    queryKey: ['admin-activity'],
    queryFn: () => api.get<ActivityDay[]>('/admin/reports/activity'),
  });

  const inventory = useQuery({
    queryKey: ['admin-inventory-audit'],
    queryFn: () => api.get<InventoryAudit>('/admin/inventory/audit'),
  });

  const isLoading =
    stats.isLoading ||
    overdue.isLoading ||
    popular.isLoading ||
    activity.isLoading ||
    inventory.isLoading;

  const error =
    stats.error ?? overdue.error ?? popular.error ?? activity.error ?? inventory.error;

  return {
    stats: stats.data,
    overdue: overdue.data ?? [],
    popular: popular.data ?? [],
    activity: activity.data ?? [],
    inventory: inventory.data,
    isLoading,
    error,
  };
}
