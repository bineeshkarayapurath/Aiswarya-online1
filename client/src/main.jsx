import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { LocaleProvider } from './context/LocaleContext';
import { ThemeProvider } from './context/ThemeContext';
import { applyClubTheme, clubConfig } from './lib/theme';
import './index.css';

// White-label boot: <title>, meta, favicon + CSS variables from clubConfig.
applyClubTheme();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <LocaleProvider>
          <ThemeProvider>
            <App />
            <Toaster
              position="top-center"
              toastOptions={{
                style: {
                  borderRadius: '12px',
                  background: clubConfig.themeColors.primary[900],
                  color: '#fff',
                  fontWeight: 600,
                },
              }}
            />
          </ThemeProvider>
        </LocaleProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);