import { QueryClient } from '@tanstack/react-query';

/** Shared QueryClient instance for the admin dashboard. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});
