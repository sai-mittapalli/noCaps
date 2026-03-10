export interface Camera {
  socketId: string;
  number: number;
  role: string;       // "Main", "Side", "Close-up", "Wide"
  isStreaming: boolean;
}

export interface Match {
  code: string;
  title: string;
  teamA: string;
  teamB: string;
  sport: string;
  venue: string;
  createdAt: Date;
  isLive: boolean;
  cameras: Map<number, Camera>;  // camera number → camera
}

export interface MatchDTO {
  code: string;
  title: string;
  teamA: string;
  teamB: string;
  sport: string;
  venue: string;
  createdAt: string;
  isLive: boolean;
  scoreA: number;
  scoreB: number;
  hostId: string | null;
  endedAt: string | null;
  cameras: CameraDTO[];
}

export interface CameraDTO {
  number: number;
  role: string;
  isStreaming: boolean;
}
