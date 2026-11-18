import type { ReactNode } from 'react';
import Dashboard from './pages/Dashboard';
import Suppliers from './pages/Suppliers';
import Fruits from './pages/Fruits';
import Stock from './pages/Stock';
import Vendors from './pages/Vendors';
import VendorMap from './pages/VendorMap';
import Purchases from './pages/Purchases';
import Sales from './pages/Sales';
import Payments from './pages/Payments';
import Reports from './pages/Reports';

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
  /** Accessible without login. Routes without this flag require authentication. Has no effect when RouteGuard is not in use. */
  public?: boolean;
}

export const routes: RouteConfig[] = [
  { name: 'Dashboard', path: '/', element: <Dashboard />, public: true },
  { name: 'Suppliers', path: '/suppliers', element: <Suppliers />, public: true },
  { name: 'Fruits', path: '/fruits', element: <Fruits />, public: true },
  { name: 'Stock', path: '/stock', element: <Stock />, public: true },
  { name: 'Vendors', path: '/vendors', element: <Vendors />, public: true },
  { name: 'Vendor Map', path: '/vendor-map', element: <VendorMap />, public: true },
  { name: 'Purchases', path: '/purchases', element: <Purchases />, public: true },
  { name: 'Sales', path: '/sales', element: <Sales />, public: true },
  { name: 'Payments', path: '/payments', element: <Payments />, public: true },
  { name: 'Reports', path: '/reports', element: <Reports />, public: true },
];
