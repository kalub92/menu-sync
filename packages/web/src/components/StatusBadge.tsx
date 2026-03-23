const statusStyles: Record<string, string> = {
  success: 'bg-green-100 text-green-800',
  completed: 'bg-green-100 text-green-800',
  active: 'bg-green-100 text-green-800',
  enabled: 'bg-green-100 text-green-800',
  error: 'bg-red-100 text-red-800',
  failed: 'bg-red-100 text-red-800',
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  disabled: 'bg-gray-100 text-gray-800',
  never: 'bg-gray-100 text-gray-600',
};

export function StatusBadge({ status }: { status: string }) {
  const style = statusStyles[status] ?? 'bg-gray-100 text-gray-800';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {status}
    </span>
  );
}
