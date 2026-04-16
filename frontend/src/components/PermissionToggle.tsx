interface PermissionToggleProps {
  status: string;
  onToggle: (newStatus: string) => void;
}

export function PermissionToggle({ status, onToggle }: PermissionToggleProps) {
  return (
    <div className="flex bg-gray-100 rounded-lg p-0.5 text-xs font-medium">
      <button
        type="button"
        onClick={() => onToggle('Auto')}
        className={`px-3 py-1 rounded-md transition-colors ${status === 'Auto' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
        Auto
      </button>
      <button
        type="button"
        onClick={() => onToggle('Allow')}
        className={`px-3 py-1 rounded-md transition-colors ${status === 'Allow' ? 'bg-green-100 text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
        Allow
      </button>
      <button
        type="button"
        onClick={() => onToggle('Ask')}
        className={`px-3 py-1 rounded-md transition-colors ${status === 'Ask' ? 'bg-orange-100 text-orange-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
        Ask
      </button>
      <button
        type="button"
        onClick={() => onToggle('Deny')}
        className={`px-3 py-1 rounded-md transition-colors ${status === 'Deny' ? 'bg-red-100 text-red-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
        Deny
      </button>
    </div>
  );
}
