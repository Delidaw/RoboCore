
export interface RobotCommand {
  type: 'MOVE' | 'LED' | 'SOUND' | 'STOP';
  payload: any;
  timestamp: number;
}

export interface LogEntry {
  id: string;
  source: 'SYSTEM' | 'AI' | 'SERIAL';
  message: string;
  timestamp: number;
}

export enum ConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR'
}
