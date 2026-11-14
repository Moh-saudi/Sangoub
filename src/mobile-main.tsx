import React from 'react';
import { createRoot } from 'react-dom/client';
import StorefrontApp from './storefront/StorefrontApp';

const root = document.getElementById('root');
if (!root) throw new Error('The Sangoub mobile app root element is missing.');

createRoot(root).render(
  <React.StrictMode>
    <StorefrontApp />
  </React.StrictMode>,
);
