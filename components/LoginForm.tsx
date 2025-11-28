import React, { useState } from 'react';
import { UserCredentials } from '../types';
import { USERS } from '../constants';
import { Button } from './Button';
import { Lock, Smartphone, Video, ShieldCheck, User, Key } from 'lucide-react';

interface LoginFormProps {
  onLogin: (user: UserCredentials) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onLogin }) => {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Case insensitive match for ID
    const matchedUser = USERS[userId.toLowerCase()];

    if (matchedUser && matchedUser.password === password) {
      onLogin(matchedUser);
    } else {
      setError('Invalid ID or Password.');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-full p-4 md:p-6 bg-gradient-to-b from-brand-900 to-black overflow-y-auto">
      <div className="w-full max-w-md bg-brand-800/50 backdrop-blur-xl p-6 md:p-8 rounded-3xl border border-white/10 shadow-2xl my-auto">
        <div className="flex justify-center mb-6">
          <div className="bg-blue-600 p-4 rounded-2xl shadow-lg shadow-blue-500/20">
            <Video className="w-8 h-8 text-white" />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-center mb-2">Secure Node</h2>
        <p className="text-gray-400 text-center mb-6 text-sm">Restricted P2P Access</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">User ID</label>
            <div className="relative">
              <User className="absolute left-4 top-3.5 w-5 h-5 text-gray-500" />
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full bg-brand-900/50 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder-gray-600"
                placeholder="Enter User ID"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 w-5 h-5 text-gray-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-brand-900/50 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder-gray-600"
                placeholder="Enter Password"
              />
            </div>
          </div>

          {error && (
            <div className="text-red-400 text-sm text-center bg-red-900/20 py-2 rounded-lg border border-red-500/20">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full mt-2">
            Connect to Node
          </Button>
        </form>
        
        {/* Credentials Table */}
        <div className="mt-8 bg-black/40 rounded-xl overflow-hidden border border-white/10">
          <div className="bg-white/5 p-3 border-b border-white/10 flex items-center gap-2">
            <ShieldCheck size={16} className="text-blue-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-gray-300">Authorized Access Credentials</span>
          </div>
          
          <div className="divide-y divide-white/5">
            <div className="grid grid-cols-12 gap-2 p-3 items-center hover:bg-white/5 transition-colors">
              <div className="col-span-1 text-gray-400"><Smartphone size={16} /></div>
              <div className="col-span-6 flex flex-col">
                <span className="text-sm font-medium text-white">User 1</span>
                <span className="text-[10px] text-gray-500 uppercase">Device A</span>
              </div>
              <div className="col-span-5 flex flex-col items-end gap-1">
                <div className="flex items-center gap-1 bg-brand-900/80 px-2 py-0.5 rounded text-xs border border-white/5">
                   <User size={10} className="text-blue-400" />
                   <span className="text-blue-200">user1</span>
                </div>
                <div className="flex items-center gap-1 bg-brand-900/80 px-2 py-0.5 rounded text-xs border border-white/5">
                   <Key size={10} className="text-gray-400" />
                   <span className="text-gray-400">password1</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-2 p-3 items-center hover:bg-white/5 transition-colors">
              <div className="col-span-1 text-gray-400"><Smartphone size={16} /></div>
              <div className="col-span-6 flex flex-col">
                <span className="text-sm font-medium text-white">User 2</span>
                <span className="text-[10px] text-gray-500 uppercase">Device B</span>
              </div>
              <div className="col-span-5 flex flex-col items-end gap-1">
                <div className="flex items-center gap-1 bg-brand-900/80 px-2 py-0.5 rounded text-xs border border-white/5">
                   <User size={10} className="text-blue-400" />
                   <span className="text-blue-200">user2</span>
                </div>
                <div className="flex items-center gap-1 bg-brand-900/80 px-2 py-0.5 rounded text-xs border border-white/5">
                   <Key size={10} className="text-gray-400" />
                   <span className="text-gray-400">password1</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-blue-900/20 p-3 text-[10px] text-center text-blue-200 border-t border-white/5">
            Login with distinct users on two different devices to start a call.
          </div>
        </div>

      </div>
    </div>
  );
};