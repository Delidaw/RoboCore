
import React from 'react';

interface Props {
  audioLevel: number;
  isAITalking: boolean;
  isThinking?: boolean;
}

const RobotVisualizer: React.FC<Props> = ({ audioLevel, isAITalking, isThinking }) => {
  // Scaling effect based on audio volume (clamped for stability)
  const reactiveScale = 1 + Math.min(audioLevel * 2, 0.5);
  const coreScale = 1 + Math.min(audioLevel * 1.5, 0.4);
  const ringOpacity = 0.2 + Math.min(audioLevel * 3, 0.8);

  return (
    <div className="relative flex items-center justify-center w-64 h-64">
      {/* Sound Ripple Layer (Reactive to any input sound) */}
      {audioLevel > 0.02 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full border border-blue-400/40 animate-[ping_2s_linear_infinite]"
              style={{
                width: '100%',
                height: '100%',
                animationDelay: `${i * 0.5}s`,
                transform: `scale(${0.6 + audioLevel})`,
                opacity: Math.max(0, 0.6 - (audioLevel * 0.4))
              }}
            />
          ))}
        </div>
      )}

      {/* Outer Reactive Glow Ring */}
      <div 
        className={`absolute inset-0 rounded-full border-2 transition-all duration-75 ease-out
          ${isAITalking ? 'border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.6)]' : 'border-zinc-800'}
        `}
        style={{ 
          transform: `scale(${reactiveScale * 1.15})`, 
          opacity: isAITalking ? 1 : ringOpacity,
          borderColor: audioLevel > 0.05 ? 'rgba(59, 130, 246, 0.5)' : undefined
        }}
      />
      
      {/* Pulse Rings - Standard breathing animation */}
      <div className={`absolute inset-4 rounded-full border border-blue-500/20 ${!isThinking && !isAITalking ? 'pulse-animation' : ''}`} />
      <div className={`absolute inset-8 rounded-full border border-blue-500/10 ${!isThinking && !isAITalking ? 'pulse-animation' : ''}`} style={{ animationDelay: '0.4s' }} />

      {/* Thinking Spinner */}
      {isThinking && !isAITalking && (
        <div className="absolute inset-0 border-2 border-dashed border-blue-400/40 rounded-full animate-[spin_2s_linear_infinite]" />
      )}

      {/* Core AI Interface - Scales with volume */}
      <div 
        className={`relative w-32 h-32 rounded-full flex items-center justify-center transition-all duration-75 shadow-2xl
          ${isAITalking ? 'bg-blue-600 shadow-[0_0_60px_rgba(37,99,235,0.7)]' : isThinking ? 'bg-blue-900/60' : audioLevel > 0.05 ? 'bg-zinc-800 ring-2 ring-blue-500/30' : 'bg-zinc-800'}
        `}
        style={{ transform: `scale(${coreScale})` }}
      >
        <div className={`w-16 h-16 rounded-full border-4 transition-colors ${isAITalking ? 'border-white/60' : 'border-zinc-700'} flex items-center justify-center`}>
          <div className={`w-8 h-8 rounded-full transition-all ${isAITalking || isThinking || audioLevel > 0.05 ? 'bg-white shadow-[0_0_20px_rgba(255,255,255,0.9)]' : 'bg-zinc-600'}`} 
               style={{ transform: `scale(${1 + audioLevel * 0.6})` }}
          />
        </div>

        {/* Reactive Orbiting Dots */}
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className={`absolute w-1.5 h-1.5 rounded-full transition-all duration-150
              ${isAITalking ? 'bg-blue-400' : isThinking ? 'bg-blue-300' : audioLevel > 0.05 ? 'bg-blue-500' : 'bg-zinc-700'}
            `}
            style={{
              transform: `rotate(${i * 45}deg) translateY(${-(54 + audioLevel * 25)}px) scale(${isAITalking || isThinking || audioLevel > 0.05 ? 1.5 : 0.8})`,
            }}
          />
        ))}
      </div>

      {/* Background Grid Circles */}
      <svg className="absolute w-full h-full -rotate-90 pointer-events-none opacity-40">
        <circle
          cx="128"
          cy="128"
          r="100"
          fill="none"
          stroke={isThinking || audioLevel > 0.05 ? "rgba(59, 130, 246, 0.4)" : "rgba(59, 130, 246, 0.1)"}
          strokeWidth="1"
          strokeDasharray={isThinking ? "2 2" : "4 12"}
          className="transition-colors duration-300"
        />
      </svg>
    </div>
  );
};

export default RobotVisualizer;
