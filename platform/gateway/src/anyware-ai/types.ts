export interface DetectionResult {
  eventType: string;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  label: string;
  metadata: Record<string, unknown>;
}

export interface FrameAnalysis {
  cameraId: string;
  timestamp: string;
  detections: DetectionResult[];
  processingTimeMs: number;
  engineVersion: string;
}

export interface EngineStatus {
  engine: string;
  version: string;
  status: "ready" | "loading" | "error";
  modelsLoaded: string[];
  gpuAvailable: boolean;
  inferenceCount: number;
  avgLatencyMs: number;
}

export type DetectionClass =
  | "person"
  | "face"
  | "vehicle"
  | "animal"
  | "weapon"
  | "fire"
  | "smoke"
  | "intrusion"
  | "loitering"
  | "unknown";

export const DETECTION_THRESHOLDS: Record<DetectionClass, number> = {
  person: 0.6,
  face: 0.7,
  vehicle: 0.5,
  animal: 0.5,
  weapon: 0.4,
  fire: 0.5,
  smoke: 0.5,
  intrusion: 0.7,
  loitering: 0.6,
  unknown: 0.8,
};
