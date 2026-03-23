import { NavLink, Outlet, useParams } from 'react-router-dom';

interface NavItem {
  to: string;
  label: string;
  icon: () => JSX.Element;
  end?: boolean;
}

const navItems: NavItem[] = [
  { to: '/', label: 'Restaurants', icon: StorefrontIcon },
  { to: '/sync', label: 'Sync Dashboard', icon: SyncIcon },
];

function restaurantNavItems(id: string): NavItem[] {
  return [
    { to: `/restaurants/${id}`, label: 'Overview', icon: StorefrontIcon, end: true },
    { to: `/restaurants/${id}/menus`, label: 'Menus', icon: MenuIcon },
    { to: `/restaurants/${id}/connections`, label: 'Connections', icon: LinkIcon },
    { to: `/restaurants/${id}/sync`, label: 'Sync Status', icon: SyncIcon },
    { to: `/restaurants/${id}/bulk`, label: 'Bulk Operations', icon: BulkIcon },
  ];
}

export function Layout() {
  const { restaurantId } = useParams();
  const items = restaurantId ? restaurantNavItems(restaurantId) : navItems;

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 flex-shrink-0 border-r border-gray-200 bg-white md:block">
        <div className="flex h-16 items-center border-b border-gray-200 px-6">
          <NavLink to="/" className="text-lg font-bold text-indigo-600">
            Menu Sync
          </NavLink>
        </div>
        <nav className="space-y-1 p-4">
          {restaurantId && (
            <NavLink
              to="/"
              className="mb-4 flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
            >
              <ArrowLeftIcon />
              All Restaurants
            </NavLink>
          )}
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={'end' in item ? item.end : item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <item.icon />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Mobile header */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center border-b border-gray-200 bg-white px-4 md:hidden">
          <NavLink to="/" className="text-lg font-bold text-indigo-600">
            Menu Sync
          </NavLink>
          <MobileNav items={items} restaurantId={restaurantId} />
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function MobileNav({
  items,
  restaurantId,
}: {
  items: Array<{ to: string; label: string }>;
  restaurantId?: string;
}) {
  return (
    <nav className="ml-auto flex gap-2 overflow-x-auto">
      {restaurantId && (
        <NavLink
          to="/"
          className="whitespace-nowrap rounded-md px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
        >
          Back
        </NavLink>
      )}
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            `whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium ${
              isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

// ── Inline SVG icons (keep bundle small) ────────────────────────────────────

function StorefrontIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
    </svg>
  );
}

function SyncIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182M21.015 4.356v4.992" />
    </svg>
  );
}

function BulkIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
    </svg>
  );
}
