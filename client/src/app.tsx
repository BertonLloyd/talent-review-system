import React from 'react';
import { Route, Routes } from 'react-router-dom';

import Layout from './components/Layout';
import './styles/index.css';
import NotFound from './pages/NotFound/NotFound';
import LoginPage from './pages/Login/Login';
import ReviewPage from './pages/Review/ReviewPage';
import MyScoresPage from './pages/MyScores/MyScoresPage';
import AdminPage from './pages/Admin/AdminPage';
import { SystemSettingsProvider } from './contexts/SystemSettingsContext';

const RoutesComponent = () => {
  return (
    <SystemSettingsProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<LoginPage />} />
          <Route path="review" element={<ReviewPage />} />
          <Route path="my-scores" element={<MyScoresPage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="admin/reviews" element={<AdminPage />} />
          <Route path="admin/rules" element={<AdminPage />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </SystemSettingsProvider>
  );
};

export default RoutesComponent;
