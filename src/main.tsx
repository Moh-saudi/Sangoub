import './lib/preloadRecovery';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './bootstrap.scss';
import './index.css';
import './public-extras.css';

createRoot(document.getElementById('root')!).render(<App />);
