import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Boxes,
  LayoutDashboard,
  MapPin,
  Menu,
  ReceiptText,
  ShoppingCart,
  Store,
  Truck,
  Wallet,
  Apple,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Overview',
    items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true }],
  },
  {
    title: 'Master data',
    items: [
      { to: '/suppliers', label: 'Suppliers', icon: Truck },
      { to: '/fruits', label: 'Fruits', icon: Apple },
      { to: '/stock', label: 'Stock', icon: Boxes },
      { to: '/vendors', label: 'Vendors', icon: Store },
      { to: '/vendor-map', label: 'Vendor Map', icon: MapPin },
    ],
  },
  {
    title: 'Transactions',
    items: [
      { to: '/purchases', label: 'Purchases', icon: ShoppingCart },
      { to: '/sales', label: 'Sales', icon: ReceiptText },
      { to: '/payments', label: 'Payments', icon: Wallet },
    ],
  },
  {
    title: 'Analysis',
    items: [{ to: '/reports', label: 'Reports', icon: BarChart3 }],
  },
];

const Brand = () => (
  <div className="flex items-center gap-3 px-5 py-5">
    <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-sidebar-border bg-sidebar-accent">
      <span className="font-display text-lg font-semibold text-sidebar-primary">B</span>
    </div>
    <div className="min-w-0">
      <p className="truncate font-display text-base font-semibold leading-tight text-sidebar-foreground">
        Batloung Farm
      </p>
      <p className="mt-0.5 truncate text-xs font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/55">
        Distribution System
      </p>
    </div>
  </div>
);

const NavList = ({ onNavigate }: { onNavigate?: () => void }) => (
  <nav className="flex-1 overflow-y-auto px-3 pb-6">
    {NAV_GROUPS.map((group) => (
      <div key={group.title} className="mb-5">
        <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/40">
          {group.title}
        </p>
        <ul className="space-y-0.5">
          {group.items.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'group flex min-h-11 items-center gap-3 border-l-2 px-3 text-sm transition-colors',
                    isActive
                      ? 'border-sidebar-primary bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                      : 'border-transparent text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      className={cn(
                        'h-4 w-4 shrink-0',
                        isActive ? 'text-sidebar-primary' : 'text-sidebar-foreground/50',
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    ))}
  </nav>
);

const AppLayout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const currentLabel =
    NAV_GROUPS.flatMap((group) => group.items).find((item) =>
      item.end ? location.pathname === item.to : location.pathname.startsWith(item.to),
    )?.label ?? 'Dashboard';

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <Brand />
        <div className="mx-5 mb-4 h-px bg-sidebar-border" />
        <NavList />
        <div className="border-t border-sidebar-border px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/40">
            Depot
          </p>
          <p className="mt-1 text-xs text-sidebar-foreground/70">Maseru, Lesotho</p>
        </div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-full flex-col">
            <Brand />
            <div className="mx-5 mb-4 h-px bg-sidebar-border" />
            <NavList onNavigate={() => setMobileOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur md:px-8">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-10 w-10 items-center justify-center border border-border bg-card text-foreground md:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Batloung Farm · Maseru, Lesotho
            </p>
            <p className="truncate text-sm font-medium text-foreground">{currentLabel}</p>
          </div>
          <p className="hidden shrink-0 text-xs text-muted-foreground md:block">
            {new Date().toLocaleDateString('en-GB', {
              weekday: 'short',
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </p>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
