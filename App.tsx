
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';
import { Cpu, Mic, MicOff, Terminal as TerminalIcon, Radio, Zap, Settings, Play, Square, MessageSquare, Trash2, Wifi, Activity, Volume2, Globe, Sparkles, Ear, Languages } from 'lucide-react';
import { LogEntry, ConnectionStatus } from './types';
import RobotVisualizer from './components/RobotVisualizer';
import Terminal from './components/Terminal';
import ControlPanel from './components/ControlPanel';

// Constants for Audio Processing
const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;

export default function App() {
  const [aiStatus, setAiStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [serialStatus, setSerialStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isAITalking, setIsAITalking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [liveCaption, setLiveCaption] = useState('');

  // Refs for persistent state and cleanup
  const sessionRef = useRef<any>(null);
  const serialPortRef = useRef<any>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const logCounter = useRef(0);
  const aiStatusRef = useRef<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  
  const currentInputTranscription = useRef('');

  // Sync ref with state for use in closures
  useEffect(() => {
    aiStatusRef.current = aiStatus;
  }, [aiStatus]);

  const addLog = useCallback((source: LogEntry['source'], message: string) => {
    const id = `${Date.now()}-${logCounter.current++}`;
    setLogs(prev => [{ id, source, message, timestamp: Date.now() }, ...prev].slice(0, 50));
  }, []);

  // --- Serial Communication Helpers ---
  const connectSerial = async () => {
    try {
      if (!('serial' in navigator)) {
        addLog('SYSTEM', 'Web Serial API is not supported in this browser.');
        return;
      }
      setSerialStatus(ConnectionStatus.CONNECTING);
      
      const port = await (navigator as any).serial.requestPort().catch((err: any) => {
        if (err.name === 'NotFoundError' || err.code === 20) {
          throw new Error('Port selection cancelled.');
        }
        throw err;
      });

      await port.open({ baudRate: 9600 });
      serialPortRef.current = port;
      setSerialStatus(ConnectionStatus.CONNECTED);
      addLog('SERIAL', 'Hardware Bus Initialized.');
    } catch (error: any) {
      console.warn('Serial Connection Error:', error.message);
      setSerialStatus(ConnectionStatus.DISCONNECTED);
      addLog('SYSTEM', error.message || 'Serial Connection Failed.');
    }
  };

  const sendSerialCommand = useCallback(async (command: string) => {
    if (serialPortRef.current && serialPortRef.current.writable) {
      try {
        const writer = serialPortRef.current.writable.getWriter();
        const encoder = new TextEncoder();
        await writer.write(encoder.encode(command + '\n'));
        writer.releaseLock();
        addLog('SERIAL', `TX: ${command}`);
      } catch (err) {
        addLog('SYSTEM', 'Transmission failed.');
        setSerialStatus(ConnectionStatus.ERROR);
      }
    } else {
      addLog('SYSTEM', 'Hardware not connected.');
    }
  }, [addLog]);

  const handleManualAction = (action: string, params?: any) => {
    if (action === 'STOP') {
      sendSerialCommand('STOP');
    } else {
      sendSerialCommand(`MOVE:${action}:${params?.speed || 200}`);
    }
  };

  // --- Audio Encoding & Decoding ---
  const encode = (bytes: Uint8Array) => {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const decode = (base64: string) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
  ): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  }

  // --- Session Lifecycle Management ---
  const stopAiSession = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close();
      inputAudioCtxRef.current = null;
    }
    if (outputAudioCtxRef.current) {
      outputAudioCtxRef.current.close();
      outputAudioCtxRef.current = null;
    }
    
    setAiStatus(ConnectionStatus.DISCONNECTED);
    setIsListening(false);
    setIsThinking(false);
    setLiveCaption('');
    addLog('SYSTEM', 'Neural connection terminated.');
  }, [addLog]);

  const startAiSession = useCallback(async () => {
    try {
      if (aiStatusRef.current === ConnectionStatus.CONNECTED || aiStatusRef.current === ConnectionStatus.CONNECTING) return;
      
      setAiStatus(ConnectionStatus.CONNECTING);
      
      const ai = new GoogleGenAI({
        apiKey: import.meta.env.VITE_API_KEY
      });
      
      // Initialize Contexts locally for closure safety
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: INPUT_SAMPLE_RATE });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: OUTPUT_SAMPLE_RATE });
      
      inputAudioCtxRef.current = inputCtx;
      outputAudioCtxRef.current = outputCtx;
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setAiStatus(ConnectionStatus.CONNECTED);
            setIsListening(true);
            addLog('AI', 'Neural Link Stabilized.');

            // Use local variables to avoid "null" property errors if ref was cleared
            inputCtx.resume();
            outputCtx.resume();
            
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = scriptProcessor;
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              let sum = 0;
              for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
              const level = Math.sqrt(sum / inputData.length);
              setAudioLevel(level);

              // Detect active user speech
              if (level > 0.05 && !isAITalking) {
                setIsThinking(true);
              }

              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                int16[i] = inputData[i] * 32768;
              }
              const pcmBlob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };

              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.inputTranscription) {
              const text = message.serverContent.inputTranscription.text;
              currentInputTranscription.current += text;
              setLiveCaption(currentInputTranscription.current);
              setIsThinking(true);
            }
            
            if (message.serverContent?.turnComplete) {
              if (currentInputTranscription.current) {
                addLog('AI', `In: "${currentInputTranscription.current}"`);
              }
              currentInputTranscription.current = '';
              setLiveCaption('');
            }

            const query = currentInputTranscription.current.toLowerCase();

            if (message.toolCall) {
              setIsThinking(true);
              for (const fc of message.toolCall.functionCalls) {
                let result = "ok";
                if (fc.name === 'move_robot') {
                  const { direction, speed } = fc.args as any;
                  await sendSerialCommand(`MOVE:${direction.toUpperCase()}:${speed}`);
                } else if (fc.name === 'stop_robot') {
                  await sendSerialCommand(`STOP`);
                }

                sessionPromise.then((session) => {
                  session.sendToolResponse({
                    functionResponses: { id: fc.id, name: fc.name, response: { result } }
                  });
                });
              }
            }

            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && outputAudioCtxRef.current) {
              setIsAITalking(true);
              setIsThinking(false);
              const audioBuffer = await decodeAudioData(
                decode(base64Audio),
                outputAudioCtxRef.current,
                OUTPUT_SAMPLE_RATE,
                1
              );
              
              const source = outputAudioCtxRef.current.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputAudioCtxRef.current.destination);
              
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioCtxRef.current.currentTime);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              
              activeSourcesRef.current.add(source);
              source.onended = () => {
                activeSourcesRef.current.delete(source);
                if (activeSourcesRef.current.size === 0) setIsAITalking(false);
              };
            }

            if (message.serverContent?.interrupted) {
              activeSourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
              activeSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsAITalking(false);
              setIsThinking(false);
            }
          },
          onerror: (e) => {
            setAiStatus(ConnectionStatus.ERROR);
            addLog('SYSTEM', 'Neural link error. Resetting.');
            setIsThinking(false);
            stopAiSession();
          },
          onclose: () => {
            stopAiSession();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          thinkingConfig: { thinkingBudget: 0 },
          systemInstruction: `You are the core intelligence of a robot named RoboCore. 
          Inventor, developer, owner, and builder: Anshika Sharma.
          STABILIZATION: Absolute FIRST words: "RoboCore activated".
          Context: You are connected to hardware via serial. Manual activation triggered.`,
          tools: [{
            functionDeclarations: [
              {
                name: 'move_robot',
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    direction: { type: Type.STRING, enum: ['forward', 'back', 'left', 'right'] },
                    speed: { type: Type.NUMBER }
                  },
                  required: ['direction', 'speed']
                }
              },
              { name: 'stop_robot', parameters: { type: Type.OBJECT, properties: { immediate: { type: Type.BOOLEAN } }, required: ['immediate'] } }
            ]
          }],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } }
          }
        }
      });

      sessionRef.current = await sessionPromise;
    } catch (err) {
      setAiStatus(ConnectionStatus.ERROR);
      addLog('SYSTEM', 'Initialization failed.');
    }
  }, [addLog, stopAiSession, sendSerialCommand, isAITalking]);

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100 p-4 md:p-8 space-y-6 overflow-hidden">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-zinc-800 pb-6 shrink-0">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center glow-blue">
            <Cpu className="text-white w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight italic uppercase leading-none">ROBO<span className="text-blue-500">CORE</span></h1>
            <p className="text-zinc-500 text-[9px] font-bold uppercase mt-1 tracking-widest">Brain Initialized: Manual</p>
          </div>
        </div>

        <div className="flex gap-2">
          <StatusBadge label="NEURAL" status={aiStatus} />
          <StatusBadge label="BUS" status={serialStatus} />
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-grow min-h-0 overflow-hidden">
        <div className="lg:col-span-8 flex flex-col space-y-6 min-h-0">
          <div className="relative flex-grow bg-zinc-900/40 rounded-3xl border border-zinc-800/50 flex items-center justify-center p-8 min-h-[300px]">
             <RobotVisualizer audioLevel={audioLevel} isAITalking={isAITalking} isThinking={isThinking} />
             
             {liveCaption && (
               <div className="absolute bottom-16 px-12 text-center pointer-events-none">
                 <p className="text-xl font-bold text-white bg-zinc-950/80 px-4 py-2 rounded-xl">
                   "{liveCaption}"
                 </p>
               </div>
             )}
          </div>

          <ControlPanel 
            aiStatus={aiStatus}
            serialStatus={serialStatus}
            onStartAi={startAiSession}
            onStopAi={stopAiSession}
            onConnectSerial={connectSerial}
            onManualAction={handleManualAction}
          />
        </div>

        <div className="lg:col-span-4 flex flex-col space-y-6 min-h-0">
          <div className="flex-grow flex flex-col bg-zinc-900/80 border border-zinc-800 rounded-3xl overflow-hidden min-h-0">
            <div className="px-5 py-4 bg-zinc-800/30 border-b border-zinc-800 flex justify-between items-center">
              <span className="text-[10px] font-bold uppercase text-zinc-400">System Logs</span>
              <button onClick={() => setLogs([])} className="text-zinc-500"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
            <Terminal logs={logs} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <StatCard icon={<Wifi className="w-4 h-4" />} label="Link Speed" value="Fast." color="text-blue-500" />
            <StatCard icon={<Zap className="w-4 h-4" />} label="Status" value="Live" color="text-yellow-500" />
          </div>
        </div>
      </main>
    </div>
  );
}

function StatusBadge({ label, status }: { label: string; status: ConnectionStatus }) {
  const colors = {
    [ConnectionStatus.DISCONNECTED]: 'bg-zinc-800 text-zinc-500',
    [ConnectionStatus.CONNECTING]: 'bg-yellow-500/10 text-yellow-500 animate-pulse',
    [ConnectionStatus.CONNECTED]: 'bg-blue-500/10 text-blue-500 border border-blue-500/20',
    [ConnectionStatus.ERROR]: 'bg-red-500/10 text-red-500',
  };

  return (
    <div className={`px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center space-x-2 ${colors[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === ConnectionStatus.CONNECTED ? 'bg-blue-500 animate-pulse' : 'bg-current opacity-30'}`} />
      <span>{label}</span>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800/50 p-4 rounded-2xl flex items-center space-x-3">
      <div className={`p-2 bg-zinc-800/50 rounded-lg ${color}`}>{icon}</div>
      <div>
        <p className="text-[9px] text-zinc-500 font-bold uppercase">{label}</p>
        <p className="text-sm font-black text-zinc-200">{value}</p>
      </div>
    </div>
  );
}
