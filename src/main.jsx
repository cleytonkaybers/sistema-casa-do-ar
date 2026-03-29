import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

// Sinaliza que o app montou; remove o splash quando o timer também terminar
window.__appMounted = true;
if (window.__splashTimerDone) {
  window.__hideSplash && window.__hideSplash();
}