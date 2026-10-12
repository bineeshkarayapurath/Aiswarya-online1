import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/client';

const AuthContext = createContext({
  user: null,
  token: null,
  setAuth: () => {},
  logout: () => {},
});

function readStored() {
  try {
    const token = localStorage.getItem('al_token');
    const user = JSON.parse(localStorage.getItem('al_user') || 'null');
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
}

export function AuthProvider({ children }) {
  const [state, setState] = useState(readStored);

  const setAuth = (token, user) => {
    localStorage.setItem('al_token', token);
    localStorage.setItem('al_user', JSON.stringify(user));
    setState({ token, user });
  };

  const logout = () => {
    localStorage.removeItem('al_token');
    localStorage.removeItem('al_user');
    setState({ token: null, user: null });
  };

  useEffect(() => {
    const onStorage = () => setState(readStored());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // On mount, silently re-fetch the current user from the API so fields an
  // officer may have changed since this browser last loaded — most visibly the
  // member photo that drives the navbar avatar — are picked up on the next page
  // load instead of staying frozen in the localStorage copy.
  useEffect(() => {
    const token = localStorage.getItem('al_token');
    if (!token) return;

    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/auth/me');
        if (cancelled || !data?.user) return;
        const next = JSON.stringify(data.user);
        if (localStorage.getItem('al_user') !== next) setAuth(token, data.user);
      } catch (err) {
        // A 401 means the token is expired/revoked — end the session. Any other
        // failure (offline, server hiccup) keeps the cached user so the app
        // still renders without throwing the member out.
        if (err?.response?.status === 401) logout();
      }
    })();

    return () => {
      cancelled = true;
    };
    // Runs once on mount. setAuth/logout are recreated per render, and re-running
    // on every state change would defeat the purpose of this refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, setAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);