import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './mobile-site.css';
import './public-extras.css';

createRoot(document.getElementById('root')!).render(<App />);
