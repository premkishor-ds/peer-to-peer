import React, { useEffect, useRef, useState, useCallback } from 'react';
import Peer, { MediaConnection } from 'peerjs';
import { UserCredentials } from '../types';
import { PEER_CONFIG } from '../constants';
import { Button } from './Button';
import { 
  Mic, MicOff, Video as VideoIcon, VideoOff, 
  PhoneOff, RefreshCw, Smartphone, Monitor, AlertCircle, Loader2 
} from 'lucide-react';

interface VideoCallProps {
  user: UserCredentials;
  onLogout: () => void;
}

export const VideoCall: React.FC<VideoCallProps> = ({ user, onLogout }) => {
  const [peer, setPeer] = useState<Peer | null>(null);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connState, setConnState] = useState<'idle' | 'calling' | 'connected' | 'incoming'>('idle');
  const [incomingCall, setIncomingCall] = useState<MediaConnection | null>(null);
  const [activeCall, setActiveCall] = useState<MediaConnection | null>(null);
  
  // Controls
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [statusMsg, setStatusMsg] = useState('Initializing secure node...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Refs for state access inside async callbacks
  const isMutedRef = useRef(isMuted);
  const isVideoOffRef = useRef(isVideoOff);
  const activeCallRef = useRef<MediaConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    isVideoOffRef.current = isVideoOff;
  }, [isVideoOff]);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  // Initialize Peer
  useEffect(() => {
    // Reset state on mount
    setErrorMsg(null);
    setStatusMsg('Connecting to secure network...');
    
    const newPeer = new Peer(user.id, PEER_CONFIG);

    newPeer.on('open', (id) => {
      console.log('My peer ID is: ' + id);
      setPeerId(id);
      setStatusMsg(`Node Active: ${user.username}`);
      setErrorMsg(null);
    });

    newPeer.on('call', (call) => {
      console.log('Incoming call from:', call.peer);
      setIncomingCall(call);
      setConnState('incoming');
      setStatusMsg(`Incoming transmission from ${call.peer}...`);
    });

    newPeer.on('error', (err) => {
      console.error('Peer error:', err);
      if (err.type === 'peer-unavailable') {
        setErrorMsg(`User ${user.targetId} is not online.`);
        setStatusMsg('Target node offline.');
        setConnState('idle');
        // Reset calling state after delay
        setTimeout(() => setErrorMsg(null), 3000);
      } else if (err.type === 'unavailable-id') {
        setErrorMsg('ID is taken. Are you already logged in elsewhere?');
      } else {
        setErrorMsg(`Connection Error: ${err.type}`);
      }
    });

    setPeer(newPeer);

    return () => {
      newPeer.destroy();
    };
  }, [user.id, user.username, user.targetId]);

  // Handle Local Stream (Camera)
  const initLocalStream = useCallback(async (overrideFacingMode?: 'user' | 'environment') => {
    try {
      const mode = overrideFacingMode || facingMode;
      
      // STOP previous tracks first - crucial for mobile devices that can't handle multiple streams
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }

      console.log(`Requesting camera with facingMode: ${mode}`);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: mode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: true
      });

      // Apply current mute/video-off states
      stream.getAudioTracks().forEach(t => t.enabled = !isMutedRef.current);
      stream.getVideoTracks().forEach(t => t.enabled = !isVideoOffRef.current);

      setLocalStream(stream);
      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // If in active call, replace tracks
      if (activeCallRef.current && activeCallRef.current.peerConnection) {
        const senders = activeCallRef.current.peerConnection.getSenders();
        
        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];

        if (videoTrack) {
          const videoSender = senders.find((s) => s.track?.kind === 'video');
          if (videoSender) {
            console.log('Replacing video track...');
            await videoSender.replaceTrack(videoTrack);
          }
        }
        
        if (audioTrack) {
            const audioSender = senders.find((s) => s.track?.kind === 'audio');
            if (audioSender) {
              console.log('Replacing audio track...');
              await audioSender.replaceTrack(audioTrack);
            }
        }
      }

    } catch (err) {
      console.error("Failed to get local stream", err);
      setErrorMsg('Camera access failed. Please allow permissions.');
      setStatusMsg('Camera Error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]); // activeCallRef used inside

  // Start stream on mount
  useEffect(() => {
    initLocalStream();
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Watch for remote stream changes
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const toggleCamera = async () => {
    // Determine new mode
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
    // Explicitly call init with new mode
    await initLocalStream(newMode);
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const startCall = () => {
    if (!peer || !localStream) {
        console.warn('Cannot start call: Peer or Stream not ready');
        return;
    }
    if (!peerId) {
        setErrorMsg('Network initializing... please wait.');
        return;
    }

    setStatusMsg(`Calling ${user.targetId}...`);
    setConnState('calling');
    
    const call = peer.call(user.targetId, localStream);
    handleCallEvents(call);
    setActiveCall(call);
  };

  const answerCall = () => {
    if (!incomingCall || !localStream) return;
    
    setStatusMsg('Connecting...');
    incomingCall.answer(localStream);
    handleCallEvents(incomingCall);
    setActiveCall(incomingCall);
    setIncomingCall(null);
    setConnState('connected');
  };

  const endCall = () => {
    if (activeCall) {
      activeCall.close();
    }
    if (incomingCall) {
      incomingCall.close();
    }
    setRemoteStream(null);
    setActiveCall(null);
    setIncomingCall(null);
    setConnState('idle');
    setStatusMsg(`Node Active: ${user.username}`);
  };

  const handleCallEvents = (call: MediaConnection) => {
    call.on('stream', (remoteStream) => {
      console.log('Received remote stream');
      setRemoteStream(remoteStream);
      setConnState('connected');
      setStatusMsg('Secure Link Established');
      setErrorMsg(null);
    });

    call.on('close', () => {
      console.log('Call closed');
      endCall();
    });

    call.on('error', (err) => {
      console.error('Call error:', err);
      endCall();
      setErrorMsg('Call Disconnected');
    });
  };

  const isReady = !!peerId && !!localStream;

  return (
    <div className="relative h-full w-full bg-black overflow-hidden flex flex-col">
      {/* Remote Video (Full Screen) */}
      <div className="flex-1 relative bg-brand-900">
        {remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4 p-6 text-center">
             <div className="w-24 h-24 rounded-full bg-brand-800 flex items-center justify-center relative">
                {!isReady ? (
                    <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                ) : (
                    <Monitor className="w-10 h-10 opacity-50" />
                )}
                <div className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-brand-900 ${isReady ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
             </div>
             <div>
               <p className="font-semibold text-white text-lg">{statusMsg}</p>
               <p className="text-xs mt-2 text-gray-400">My ID: {user.id}</p>
               {errorMsg && (
                 <div className="mt-4 bg-red-500/10 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm flex items-center justify-center gap-2">
                    <AlertCircle size={16} />
                    {errorMsg}
                 </div>
               )}
             </div>
          </div>
        )}
      </div>

      {/* Local Video (PiP) */}
      <div className="absolute top-4 right-4 w-28 h-40 md:w-48 md:h-64 bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/20 transition-all z-20">
         <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted // Always mute local video
            className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
          />
          <div className="absolute bottom-2 left-2 text-[10px] bg-black/50 px-2 py-1 rounded text-white backdrop-blur-sm">
            {user.username} {isMuted && '(Muted)'}
          </div>
      </div>

      {/* Floating Status Badge */}
      <div className="absolute top-4 left-4 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-2 z-20">
        <div className={`w-2 h-2 rounded-full ${connState === 'connected' ? 'bg-green-500 animate-pulse' : connState === 'calling' ? 'bg-yellow-500 animate-ping' : isReady ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-xs font-medium text-white/80">
            {connState === 'idle' ? 'Standby' : connState === 'calling' ? 'Calling...' : connState === 'connected' ? 'Connected' : 'Incoming...'}
        </span>
      </div>

      {/* Call Incoming Overlay */}
      {connState === 'incoming' && (
         <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="bg-brand-800 p-8 rounded-3xl border border-white/10 shadow-2xl w-full max-w-sm text-center">
              <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                <Smartphone className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Incoming Call</h3>
              <p className="text-gray-400 mb-8">Secure node requesting access...</p>
              <div className="flex gap-4">
                <Button onClick={endCall} variant="danger" className="flex-1">
                   Decline
                </Button>
                <Button onClick={answerCall} className="bg-green-500 hover:bg-green-600 flex-1">
                   Accept
                </Button>
              </div>
            </div>
         </div>
      )}

      {/* Controls Bar */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent z-30">
        <div className="flex items-center justify-center gap-4 md:gap-8 max-w-lg mx-auto">
          
          {connState === 'idle' ? (
             <Button 
                onClick={startCall} 
                disabled={!isReady}
                className={`w-full py-4 text-lg transition-all ${!isReady ? 'opacity-50 grayscale' : 'bg-green-500 hover:bg-green-600 shadow-green-900/50'}`}
             >
                {isReady ? 'Start Secure Call' : 'Initializing...'}
             </Button>
          ) : (
            <>
              <button 
                onClick={toggleVideo}
                className={`p-4 rounded-full backdrop-blur-md border transition-all ${isVideoOff ? 'bg-red-500/80 border-red-500 text-white' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'}`}
              >
                {isVideoOff ? <VideoOff size={24} /> : <VideoIcon size={24} />}
              </button>

              <button 
                onClick={toggleMute}
                className={`p-4 rounded-full backdrop-blur-md border transition-all ${isMuted ? 'bg-red-500/80 border-red-500 text-white' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'}`}
              >
                {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
              </button>

              <button 
                onClick={endCall}
                className="p-5 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/50 transition-transform hover:scale-105 active:scale-95"
              >
                <PhoneOff size={32} />
              </button>

              <button 
                onClick={toggleCamera}
                disabled={connState !== 'connected' && connState !== 'calling'} 
                className="p-4 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20 transition-all active:rotate-180"
                title="Switch Camera"
              >
                <RefreshCw size={24} />
              </button>
            </>
          )}

        </div>
        <div className="text-center mt-4">
            <button onClick={onLogout} className="text-xs text-gray-500 underline hover:text-gray-300">
               Disconnect from Node (Logout)
            </button>
        </div>
      </div>
    </div>
  );
};