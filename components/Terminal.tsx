
import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';

interface Props {
  logs: LogEntry[];
}

const Terminal: React.FC<Props> = ({ logs }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="flex-grow overflow-y-auto p-4 font-mono text-[11px] leading-relaxed space-y-2 custom-scrollbar">
      {logs.length === 0 ? (
        <div className="text-zinc-600 italic">Waiting for connection...</div>
      ) : (
        logs.map((log) => (
          <div key={log.id} className="group">
            <span className="text-zinc-600 mr-2">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
            <span className={`font-bold mr-2 ${
              log.source === 'AI' ? 'text-blue-500' : 
              log.source === 'SERIAL' ? 'text-green-500' : 'text-zinc-400'
            }`}>
              {log.source}:
            </span>
            <span className="text-zinc-300 group-hover:text-white transition-colors">{log.message}</span>
          </div>
        ))
      )}
      <div ref={endRef} />
    </div>
  );
};

export default Terminal;
