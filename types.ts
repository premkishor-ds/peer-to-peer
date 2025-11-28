export enum UserRole {
  USER_A = 'USER_A',
  USER_B = 'USER_B',
}

export interface UserCredentials {
  id: string; // PeerJS ID
  username: string;
  role: UserRole;
  targetId: string; // The ID of the person they can call
}

export interface CallState {
  isCalling: boolean;
  isIncoming: boolean;
  isConnected: boolean;
  remoteStream: MediaStream | null;
}