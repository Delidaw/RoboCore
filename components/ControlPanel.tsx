
import React from 'react';
import { Play, Square, Usb, Info, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, XCircle } from 'lucide-react';
import { ConnectionStatus } from '../types';

interface Props {
  aiStatus: ConnectionStatus;
  serialStatus: ConnectionStatus;
  onStartAi: () => void;
  onStopAi: () => void;
  onConnectSerial: () => void;
  onManualAction: (action: string, params?: any) => void;
}

const ControlPanel: React.FC<Props> = ({ aiStatus, serialStatus, onStartAi, onStopAi, onConnectSerial, onManualAction }) => {
  const isAiActive = aiStatus === ConnectionStatus.CONNECTED || aiStatus === ConnectionStatus.CONNECTING;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-6">
      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* Gemini Control */}
        <div className="flex-1 space-y-3">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] px-1 italic">Neural Engine</label>
          <div className="flex gap-2 h-full">
            {!isAiActive ? (
              <button 
                onClick={onStartAi}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-6 rounded-2xl flex items-center justify-center space-x-2 transition-all transform hover:scale-[1.02] active:scale-[0.98] glow-blue"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>Initialize AI Brain</span>
              </button>
            ) : (
              <button 
                onClick={onStopAi}
                className="flex-1 bg-zinc-800 hover:bg-red-500/20 text-zinc-300 hover:text-red-500 border border-zinc-700 hover:border-red-500/50 font-bold py-4 px-6 rounded-2xl flex items-center justify-center space-x-2 transition-all"
              >
                <Square className="w-5 h-5 fill-current" />
                <span>Terminate</span>
              </button>
            )}
          </div>
        </div>

        {/* Hardware & Manual Override */}
        <div className="flex-[1.5] flex flex-col md:flex-row gap-6">
          <div className="flex-1 space-y-3">
             <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] px-1 italic">Manual Override</label>
             <div className="grid grid-cols-3 gap-2 w-fit mx-auto md:mx-0">
                <div />
                <ControlBtn icon={<ChevronUp />} onClick={() => onManualAction('FORWARD')} />
                <div />
                <ControlBtn icon={<ChevronLeft />} onClick={() => onManualAction('LEFT')} />
                <ControlBtn icon={<XCircle className="text-red-500" />} onClick={() => onManualAction('STOP')} active />
                <ControlBtn icon={<ChevronRight />} onClick={() => onManualAction('RIGHT')} />
                <div />
                <ControlBtn icon={<ChevronDown />} onClick={() => onManualAction('BACK')} />
                <div />
             </div>
          </div>

          <div className="flex-1 space-y-3">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] px-1 italic">Physical Link</label>
            <button 
              onClick={onConnectSerial}
              disabled={serialStatus === ConnectionStatus.CONNECTED}
              className={`w-full h-[116px] font-bold rounded-2xl flex flex-col items-center justify-center space-y-2 transition-all border
                ${serialStatus === ConnectionStatus.CONNECTED 
                  ? 'bg-green-500/10 border-green-500/50 text-green-500' 
                  : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-white hover:border-zinc-500'}
              `}
            >
              <Usb className={`w-6 h-6 ${serialStatus === ConnectionStatus.CONNECTED ? 'animate-pulse' : ''}`} />
              <span className="text-xs">{serialStatus === ConnectionStatus.CONNECTED ? 'Link Active' : 'Connect Arduino'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 bg-zinc-950/50 rounded-2xl border border-zinc-800/50 flex items-start space-x-3">
        <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-[11px] text-zinc-500 leading-relaxed italic">
          <span className="text-zinc-300 font-bold">PRO TIP:</span> Voice commands like "go forward" work instantly, but use the <span className="text-blue-400">Manual Override</span> buttons if the environment is too noisy for clear audio detection.
        </p>
      </div>
    </div>
  );
};

function ControlBtn({ icon, onClick, active }: { icon: React.ReactNode; onClick: () => void; active?: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90
        ${active ? 'bg-zinc-800 text-white shadow-lg' : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 hover:text-white border border-zinc-800'}
      `}
    >
      {icon}
    </button>
  );
}

export default ControlPanel;
