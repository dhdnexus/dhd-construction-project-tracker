import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AdminPortal } from './pages/AdminPortal.tsx';
import './index.css';

const isAdminRoute = window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdminRoute ? <AdminPortal /> : <App />}
  </StrictMode>,
);
