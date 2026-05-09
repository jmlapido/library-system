interface StatusBadgeProps {
  available: number;
  total: number;
  size?: 'sm' | 'md';
}

const STATUS_COLORS: Record<string, string> = {
  available: '#22c55e',
  checkedOut: '#f59e0b',
};

/**
 * Displays availability status for a book with color-coded indicator.
 * Green when available, amber when fully checked out.
 */
export function StatusBadge({ available, total, size = 'sm' }: StatusBadgeProps) {
  const isAvailable = available > 0;
  const bg = isAvailable ? STATUS_COLORS.available : STATUS_COLORS.checkedOut;
  const label = isAvailable ? '✓ Available' : 'Checked out';
  const fontSize = size === 'sm' ? 9 : 11;

  return (
    <span
      style={{
        background: bg,
        color: 'white',
        borderRadius: 4,
        padding: size === 'sm' ? '1px 5px' : '2px 8px',
        fontSize,
        fontWeight: 600,
        display: 'inline-block',
      }}
    >
      {label}
    </span>
  );
}
