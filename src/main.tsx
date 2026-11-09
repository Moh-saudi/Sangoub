import './lib/devServiceWorkerCleanup';
import './lib/preloadRecovery';
import { initPwaAutoUpdate } from './lib/pwaAutoUpdate';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './bootstrap.scss';
import './index.css';
import './public-extras.css';

initPwaAutoUpdate();

createRoot(document.getElementById('root')!).render(<App />);
