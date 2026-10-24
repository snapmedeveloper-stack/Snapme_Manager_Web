import { createRoot } from 'react-dom/client';
// Urutan penting: token dulu, lalu elemen standar
import './styles/tokens.css';
import './styles/ui.css';
import { UIProvider } from './components/ui';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <UIProvider>
    <App />
  </UIProvider>,
);
