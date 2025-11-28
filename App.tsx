import React, { useState } from 'react';
import { UserCredentials } from './types';
import { LoginForm } from './components/LoginForm';
import { VideoCall } from './components/VideoCall';

const App: React.FC = () => {
  const [user, setUser] = useState<UserCredentials | null>(null);

  const handleLogin = (credentials: UserCredentials) => {
    setUser(credentials);
  };

  const handleLogout = () => {
    setUser(null);
  };

  return (
    <div className="h-full w-full">
      {!user ? (
        <LoginForm onLogin={handleLogin} />
      ) : (
        <VideoCall user={user} onLogout={handleLogout} />
      )}
    </div>
  );
};

export default App;