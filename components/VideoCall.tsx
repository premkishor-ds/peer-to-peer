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
  const [isVoiceOnly, setIsVoiceOnly] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [statusMsg, setStatusMsg] = useState('Initializing secure node...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pendingCallType, setPendingCallType] = useState<'audio' | 'video' | null>(null);

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
    
    const newPeer = new Peer(user.id, {
      ...PEER_CONFIG,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      },
    });

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
      if (err.type === 'peer-unavailable') {
        setErrorMsg(`User ${user.targetId} is not online.`);
        setStatusMsg('Target node offline.');
        setConnState('idle');
        setTimeout(() => setErrorMsg(null), 3000);
      } else if (err.type === 'unavailable-id') {
        setErrorMsg('This ID is already in use. Close other sessions or try again in a moment.');
        setStatusMsg('ID already in use');
      } else if (err.type === 'network') {
        setErrorMsg('Network error. Please check your internet connection.');
        setStatusMsg('Network error');
      } else {
        setErrorMsg(`Connection Error: ${err.type}`);
      }
    });

    newPeer.on('disconnected', () => {
      console.log('Peer disconnected.');
      setStatusMsg('Connection lost.');
      setErrorMsg('Connection lost. Please refresh or try again.');
    });

    setPeer(newPeer);

    return () => {
      newPeer.destroy();
    };
  }, [user.id, user.username, user.targetId]);

  // Handle Local Stream (Camera / Mic)
  const initLocalStream = useCallback(async (
    overrideFacingMode?: 'user' | 'environment',
    forceVoiceOnly?: boolean
  ) => {
    try {
      // Basic support check so we can show a clear message instead of a generic error
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setErrorMsg('This browser does not support camera/microphone access.');
        setStatusMsg('Media not supported');
        return;
      }

      const mode = overrideFacingMode || facingMode;
      const voiceOnly = forceVoiceOnly ?? isVoiceOnly;

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        audio: true,
        video: !voiceOnly
          ? {
              facingMode: mode,
              width: { ideal: 1280 },
              height: { ideal: 720 },
            }
          : false,
      };

      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        stream.getAudioTracks().forEach((t) => (t.enabled = !isMutedRef.current));
        if (!voiceOnly) {
          stream.getVideoTracks().forEach((t) => (t.enabled = !isVideoOffRef.current));
        }

        setLocalStream(stream);
        localStreamRef.current = stream;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        if (activeCallRef.current && activeCallRef.current.peerConnection) {
          const senders = activeCallRef.current.peerConnection.getSenders();

          const videoTrack = stream.getVideoTracks()[0];
          const audioTrack = stream.getAudioTracks()[0];

          if (videoTrack) {
            const videoSender = senders.find((s) => s.track?.kind === 'video');
            if (videoSender) {
              await videoSender.replaceTrack(videoTrack);
            }
          }

          if (audioTrack) {
            const audioSender = senders.find((s) => s.track?.kind === 'audio');
            if (audioSender) {
              await audioSender.replaceTrack(audioTrack);
            }
          }
        }
      } catch (err: any) {
        if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          // No camera: if we were trying to use video, inform once and fall back to audio-only.
          if (!voiceOnly) {
            setErrorMsg('No camera available. Switching to audio-only.');
          }
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          setLocalStream(audioStream);
          localStreamRef.current = audioStream;
          setIsVoiceOnly(true);

        } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setErrorMsg('Camera/microphone access was denied. Please allow permissions.');
        } else if (err.name === 'NotReadableError') {
          setErrorMsg('Camera/microphone is already in use by another application.');
        } else {
          setErrorMsg(`Failed to access media devices: ${err.message || 'Unknown error'}`);
        }

        if (!voiceOnly) {
          setStatusMsg('Media Error');
        }
      }
    } catch (err) {
      setErrorMsg('Could not access media devices. Please check browser permissions or try another browser.');
      setStatusMsg('Media error');
    }
  }, [facingMode, isVoiceOnly]);

  // Cleanup media tracks on unmount
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Watch for remote stream changes
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      console.log('Remote stream tracks:', {
        audio: remoteStream.getAudioTracks().length,
        video: remoteStream.getVideoTracks().length,
      });

      // Make sure incoming tracks are enabled
      remoteStream.getAudioTracks().forEach((t) => (t.enabled = true));
      remoteStream.getVideoTracks().forEach((t) => (t.enabled = true));

      const videoEl = remoteVideoRef.current;
      videoEl.srcObject = remoteStream;
      videoEl.muted = false;

      // Some browsers require an explicit play() after a user gesture
      const playPromise = videoEl.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          // Ignore autoplay errors; user can press play if needed
        });
      }
    }
  }, [remoteStream]);

  const toggleCamera = async () => {
    // Determine new mode
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
    // Explicitly call init with new mode
    await initLocalStream(newMode, false);
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = useCallback(async () => {
    if (!localStream) return;
    
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      const newState = !videoTrack.enabled;
      videoTrack.enabled = newState;
      setIsVideoOff(!newState);
      
      // If enabling video and in voice-only mode, turn off voice-only mode
      if (newState && isVoiceOnly) {
        setIsVoiceOnly(false);
      }
    }
  }, [localStream, isVoiceOnly]);

  const toggleVoiceOnly = useCallback(async () => {
    if (!localStream) return;
    
    const newVoiceOnlyState = !isVoiceOnly;
    setIsVoiceOnly(newVoiceOnlyState);
    
    // If enabling voice-only mode, turn off video
    if (newVoiceOnlyState) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack && videoTrack.enabled) {
        videoTrack.enabled = false;
        setIsVideoOff(true);
      }
    }
  }, [localStream, isVoiceOnly]);

  const startCall = () => {
    const stream = localStreamRef.current;
    if (!peer || !stream) {
      console.warn('Cannot start call: Peer or Stream not ready');
      return;
    }
    if (!peerId) {
      setErrorMsg('Network initializing... please wait.');
      return;
    }

    setStatusMsg(`Calling ${user.targetId}...`);
    setConnState('calling');

    const call = peer.call(user.targetId, stream);
    handleCallEvents(call);
    setActiveCall(call);
  };

  const answerCall = async () => {
    if (!incomingCall) return;

    // Ensure we have a local stream before answering
    let stream = localStream;
    if (!stream) {
      await initLocalStream();
      stream = localStreamRef.current;
    }
    if (!stream) {
      setErrorMsg('Unable to access microphone/camera to answer the call.');
      return;
    }

    setStatusMsg('Connecting...');
    incomingCall.answer(stream);
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

    call.on('error', () => {
      endCall();
      setErrorMsg('Call Disconnected');
    });
  };

  const handleStartVoiceCall = async () => {
    setIsVoiceOnly(true);
    setIsVideoOff(true);
    // Force pure audio-only stream so we never even try to access a camera
    await initLocalStream(undefined, true);
    if (localStreamRef.current) {
      startCall();
    }
  };

  const handleStartVideoCall = async () => {
    setIsVoiceOnly(false);
    setIsVideoOff(false);
    await initLocalStream(undefined, false);
    if (localStreamRef.current) {
      startCall();
    }
  };

  const confirmPermissionAndStart = async () => {
    if (!pendingCallType) return;
    if (pendingCallType === 'audio') {
      await handleStartVoiceCall();
    } else {
      await handleStartVideoCall();
    }
    setPendingCallType(null);
  };

  const cancelPermissionRequest = () => {
    setPendingCallType(null);
  };

  const isReady = !!peerId && !!localStream;
  const canCall = !!peerId;

  const controlButtons = (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full p-2">
      <Button
        variant={isVoiceOnly ? 'default' : 'secondary'}
        size="icon"
        onClick={toggleVoiceOnly}
        title={isVoiceOnly ? 'Switch to video call' : 'Switch to voice only'}
        className={isVoiceOnly ? 'bg-blue-500 hover:bg-blue-600' : ''}
      >
        {isVoiceOnly ? <Mic size={20} /> : <Smartphone size={20} />}
      </Button>

      <Button
        variant={isMuted ? 'destructive' : 'secondary'}
        size="icon"
        onClick={toggleMute}
        title={isMuted ? 'Unmute' : 'Mute'}
        disabled={isVoiceOnly && isMuted}
      >
        {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
      </Button>

      <Button
        variant={isVideoOff ? 'destructive' : 'secondary'}
        size="icon"
        onClick={toggleVideo}
        title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
        disabled={isVoiceOnly}
        className={isVoiceOnly ? 'opacity-50' : ''}
      >
        {isVideoOff ? <VideoOff size={20} /> : <VideoIcon size={20} />}
      </Button>

      <Button
        variant="secondary"
        size="icon"
        onClick={toggleCamera}
        title="Switch camera"
        disabled={isVoiceOnly || !localStream}
      >
        <RefreshCw size={20} />
      </Button>

      <Button
        variant="destructive"
        size="icon"
        onClick={endCall}
        title="Disconnect call"
        disabled={connState === 'idle'}
        className="ml-1 bg-red-600 hover:bg-red-700 text-white"
      >
        <PhoneOff size={20} />
      </Button>
    </div>
  );

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

               {connState === 'idle' && canCall && (
                 <div className="mt-6 flex justify-center gap-3">
                   <Button
                     onClick={() => setPendingCallType('audio')}
                     className="px-4 py-2 text-sm font-medium"
                   >
                     Audio Call
                   </Button>
                   <Button
                     onClick={() => setPendingCallType('video')}
                     className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700"
                   >
                     Video Call
                   </Button>
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
                <Button
                  onClick={endCall}
                  variant="danger"
                  className="flex-1"
                >
                   Decline
                </Button>
                <Button
                  onClick={answerCall}
                  className="bg-green-500 hover:bg-green-600 flex-1"
                >
                   Accept
                </Button>
              </div>
            </div>
          </div>
        )}

      {/* Media permission confirmation popup */}
      {pendingCallType && (
        <div className="absolute inset-0 z-60 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-brand-800 p-6 rounded-2xl border border-white/10 shadow-2xl w-full max-w-sm text-center">
            <h3 className="text-xl font-bold mb-2 text-white">Allow {pendingCallType === 'audio' ? 'microphone' : 'camera & microphone'} access?</h3>
            <p className="text-gray-300 text-sm mb-6">
              Your browser will ask for permission to use your {pendingCallType === 'audio' ? 'microphone' : 'camera and microphone'}. You can change this later in browser site settings.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={cancelPermissionRequest}
                variant="secondary"
                className="flex-1"
              >
                Decline
              </Button>
              <Button
                onClick={confirmPermissionAndStart}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                Allow
              </Button>
            </div>
          </div>
        </div>
      )}

      {controlButtons}
    </div>
  );
};

export default VideoCall;