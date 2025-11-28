import { UserRole, UserCredentials } from './types';

// Hardcoded for the requested 2-user limit demo
export const USERS: Record<string, UserCredentials & { password: string }> = {
  'user1': {
    id: 'p2p-secure-node-alpha-01',
    username: 'User One',
    password: 'password1',
    role: UserRole.USER_A,
    targetId: 'p2p-secure-node-beta-02'
  },
  'user2': {
    id: 'p2p-secure-node-beta-02',
    username: 'User Two',
    password: 'password1',
    role: UserRole.USER_B,
    targetId: 'p2p-secure-node-alpha-01'
  }
};

export const PEER_CONFIG = {
  // Using default public PeerJS server for demo purposes.
  // In production, you would run your own PeerServer.
  debug: 2,
};