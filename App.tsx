import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import IntersectObserver from '@/components/common/IntersectObserver';
import { AppWrapper } from '@/components/common/PageMeta';
import { Toaster } from '@/components/ui/sonner';
import AppLayout from '@/components/layouts/AppLayout';

import { routes } from './routes';

const App: React.FC = () => {
  return (
    <AppWrapper>
      <Router>
        <IntersectObserver />
        <Routes>
          <Route element={<AppLayout />}>
            {routes.map((route, index) => (
              <Route key={index} path={route.path} element={route.element} />
            ))}
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster />
      </Router>
    </AppWrapper>
  );
};

export default App;
