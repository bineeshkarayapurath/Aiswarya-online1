import { createContext, useContext, useEffect, useState } from 'react';

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

  return (
    <AuthContext.Provider value={{ ...state, setAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);