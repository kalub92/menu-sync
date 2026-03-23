import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/Layout';
import { RestaurantList } from './pages/RestaurantList';
import { RestaurantDetail } from './pages/RestaurantDetail';
import { MenuEditor } from './pages/MenuEditor';
import { Connections } from './pages/Connections';
import { SyncDashboard } from './pages/SyncDashboard';
import { BulkOperations } from './pages/BulkOperations';
import { GlobalSyncDashboard } from './pages/GlobalSyncDashboard';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<RestaurantList />} />
            <Route path="sync" element={<GlobalSyncDashboard />} />
            <Route path="restaurants/:restaurantId" element={<RestaurantDetail />} />
            <Route path="restaurants/:restaurantId/menus" element={<MenuEditor />} />
            <Route path="restaurants/:restaurantId/connections" element={<Connections />} />
            <Route path="restaurants/:restaurantId/sync" element={<SyncDashboard />} />
            <Route path="restaurants/:restaurantId/bulk" element={<BulkOperations />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
