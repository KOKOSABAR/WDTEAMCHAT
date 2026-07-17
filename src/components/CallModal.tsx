import React, { useState, useEffect, useRef } from "react";
import { User } from "../types.ts";
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Volume2, VolumeX, ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface CallModalProps {
  partner: User | { name: string; avatar: string; id: string };
  isVideo: boolean;
  onClose: () => void;
}

export default function CallModal({ partner, isVideo, onClose }: CallModalProps) {
  const [callState, setCallState] = useState<'ringing' | 'connected' | 'ended'>('ringing');
  const [duration, setDuration] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isVideoOn, setIsVideoOn] = useState<boolean>(isVideo);
  const [isSpeaker, setIsSpeaker] = useState<boolean>(true);

  const audioContextRef = useRef<AudioContext | null>(null);
  const ringIntervalRef = useRef<any>(null);

  // Synthesize Ringtone/Hangup Sounds using Web Audio API
  const playBeep = (freq: number, type: OscillatorType, durationMs: number) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + durationMs / 1000);
    } catch (err) {
      console.warn("Web Audio API not supported or blocked:", err);
    }
  };

  // Ring tone generator loop
  const startRingtone = () => {
    // Play a dual chord beep every 2 seconds
    const playRingSequence = () => {
      playBeep(440, "sine", 150);
      setTimeout(() => playBeep(480, "sine", 150), 100);
      setTimeout(() => {
        playBeep(440, "sine", 150);
        setTimeout(() => playBeep(480, "sine", 150), 100);
      }, 400);
    };

    playRingSequence();
    ringIntervalRef.current = setInterval(playRingSequence, 2000);
  };

  const stopRingtone = () => {
    if (ringIntervalRef.current) {
      clearInterval(ringIntervalRef.current);
      ringIntervalRef.current = null;
    }
  };

  const playHangupTone = () => {
    playBeep(330, "triangle", 150);
    setTimeout(() => playBeep(220, "triangle", 300), 150);
  };

  const playConnectTone = () => {
    playBeep(523.25, "sine", 100); // C5
    setTimeout(() => playBeep(659.25, "sine", 100), 100); // E5
    setTimeout(() => playBeep(783.99, "sine", 200), 200); // G5
  };

  useEffect(() => {
    // Start calling
    startRingtone();

    // Auto-connect after 3.5 seconds
    const connectTimer = setTimeout(() => {
      stopRingtone();
      playConnectTone();
      setCallState('connected');
    }, 3500);

    return () => {
      stopRingtone();
      clearTimeout(connectTimer);
    };
  }, []);

  // Handle call timer ticking
  useEffect(() => {
    let timer: any;
    if (callState === 'connected') {
      timer = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [callState]);

  // Handle End Call
  const handleEndCall = () => {
    stopRingtone();
    playHangupTone();
    setCallState('ended');
    setTimeout(() => {
      onClose();
    }, 1000);
  };

  // Formatting timer: 00:00
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-md flex flex-col justify-between p-8 text-white select-none">
      
      {/* Encryption Badge */}
      <div className="flex justify-center items-center gap-1.5 text-[10px] text-indigo-400 font-semibold tracking-wider uppercase bg-indigo-500/10 px-3 py-1.5 rounded-full self-center border border-indigo-500/20 shadow-sm">
        <ShieldAlert className="w-3.5 h-3.5" /> End-to-End Encrypted (LINE Secure)
      </div>

      {/* Top Section - Profile Info */}
      <div className="flex flex-col items-center mt-12 space-y-4">
        {/* Profile Pic with pulsating ring if ringing */}
        <div className="relative">
          {callState === 'ringing' && (
            <>
              <div className="absolute inset-0 bg-indigo-500 rounded-full animate-ping scale-150 opacity-15"></div>
              <div className="absolute inset-0 bg-indigo-400 rounded-full animate-ping scale-125 opacity-25"></div>
            </>
          )}
          <div className="relative w-28 h-28 rounded-full overflow-hidden border-4 border-slate-700/50 shadow-2xl bg-slate-800">
            <img src={partner.avatar} alt={partner.name} className="w-full h-full object-cover" />
          </div>
        </div>

        <div className="text-center space-y-1">
          <h3 className="text-2xl font-bold tracking-tight">{partner.name}</h3>
          <p className="text-sm text-slate-400 font-medium">
            {callState === 'ringing' ? (isVideo ? 'Memulai Panggilan Video...' : 'Memanggil...') : 
             callState === 'connected' ? (isVideoOn ? 'Panggilan Video Aktif' : 'Panggilan Suara Aktif') : 
             'Panggilan Berakhir'}
          </p>
        </div>

        {/* Call Timer */}
        {callState === 'connected' && (
          <div className="text-indigo-400 font-mono text-lg font-bold bg-slate-800/80 px-4 py-1.5 rounded-full border border-slate-700 shadow-sm animate-pulse">
            {formatTime(duration)}
          </div>
        )}
      </div>

      {/* Middle Section - Simulated Video Camera Feed */}
      <div className="flex-1 max-w-sm w-full mx-auto my-6 rounded-2xl overflow-hidden border border-slate-800 bg-slate-950/40 relative shadow-inner flex items-center justify-center p-4">
        <AnimatePresence mode="wait">
          {isVideoOn && callState === 'connected' ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 w-full h-full"
            >
              {/* Dynamic decorative abstract gradient representing camera stream */}
              <div className="w-full h-full bg-gradient-to-tr from-indigo-900/50 via-slate-900/30 to-indigo-900/45 animate-gradient relative flex items-center justify-center">
                <div className="absolute top-3 right-3 bg-slate-900/80 text-[10px] uppercase font-mono px-2 py-1 rounded border border-slate-700">
                  Kamera Depan
                </div>
                {/* Simulated picture-in-picture local camera */}
                <div className="absolute bottom-4 right-4 w-24 h-32 rounded-xl overflow-hidden border-2 border-slate-700 bg-slate-900 shadow-lg">
                  <div className="w-full h-full bg-gradient-to-br from-indigo-800/40 to-slate-950 flex items-center justify-center">
                    <span className="text-[10px] text-indigo-400 font-semibold uppercase font-mono">Anda</span>
                  </div>
                </div>
                {/* Moving design accents to look like face tracking */}
                <div className="w-48 h-48 border border-indigo-500/25 rounded-full flex items-center justify-center relative animate-pulse">
                  <div className="w-40 h-40 border border-indigo-500/10 rounded-full"></div>
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-indigo-400"></div>
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-indigo-400"></div>
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-indigo-400"></div>
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-indigo-400"></div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center text-slate-500 max-w-xs space-y-2 p-6"
            >
              <div className="mx-auto w-12 h-12 rounded-full bg-slate-800/50 flex items-center justify-center text-slate-400">
                {isVideo ? <VideoOff className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
              </div>
              <p className="text-xs font-medium">Umpan video dimatikan. Kualitas audio optimal.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Section - Action Controls */}
      <div className="space-y-8 mb-6">
        {/* Sub-toggles (Mute, Video, Speaker) */}
        <div className="flex justify-center items-center gap-8">
          {/* Mute Mic */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`w-12 h-12 rounded-full border border-slate-700 flex items-center justify-center transition-all cursor-pointer ${isMuted ? 'bg-red-500 border-red-500 text-white' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'}`}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Toggle Video (only if call was video) */}
          {isVideo && (
            <button
              onClick={() => setIsVideoOn(!isVideoOn)}
              className={`w-12 h-12 rounded-full border border-slate-700 flex items-center justify-center transition-all cursor-pointer ${!isVideoOn ? 'bg-red-500 border-red-500 text-white' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'}`}
            >
              {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>
          )}

          {/* Speakerphone */}
          <button
            onClick={() => setIsSpeaker(!isSpeaker)}
            className={`w-12 h-12 rounded-full border border-slate-700 flex items-center justify-center transition-all cursor-pointer ${isSpeaker ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'}`}
          >
            {isSpeaker ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
        </div>

        {/* Decline/End Call Big Red Button */}
        <div className="flex justify-center">
          <button
            onClick={handleEndCall}
            className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-xl shadow-red-900/30 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <PhoneOff className="w-7 h-7" />
          </button>
        </div>
      </div>

    </div>
  );
}
