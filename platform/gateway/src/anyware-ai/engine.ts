import { logger } from "../core/logger.js";
import type {
  DetectionResult,
  FrameAnalysis,
  EngineStatus,
} from "./types.js";
import { DETECTION_THRESHOLDS, type DetectionClass } from "./types.js";

let inferenceCount = 0;
let totalLatencyMs = 0;
const engineVersion = "0.1.0-stub";

const SUPPORTED_MODELS = [
  "anyware-detect-v1",
  "anyware-face-v1",
  "anyware-threat-v1",
];

export function getEngineStatus(): EngineStatus {
  return {
    engine: "AnywareAI",
    version: engineVersion,
    status: "ready",
    modelsLoaded: SUPPORTED_MODELS,
    gpuAvailable: false,
    inferenceCount,
    avgLatencyMs: inferenceCount > 0 ? totalLatencyMs / inferenceCount : 0,
  };
}

export async function analyzeFrame(
  cameraId: string,
  _frameData: Buffer | string,
  enabledClasses: DetectionClass[] = ["person", "vehicle", "face"]
): Promise<FrameAnalysis> {
  const start = performance.now();

  // Stub: generate realistic detection results
  // In production, this calls ONNX Runtime with YOLOv8 model
  const detections: DetectionResult[] = [];

  for (const cls of enabledClasses) {
    const threshold = DETECTION_THRESHOLDS[cls];
    const confidence = threshold + Math.random() * (1 - threshold);

    if (confidence >= threshold) {
      detections.push({
        eventType: cls,
        confidence: parseFloat(confidence.toFixed(3)),
        boundingBox: {
          x: Math.floor(Math.random() * 800),
          y: Math.floor(Math.random() * 600),
          width: 50 + Math.floor(Math.random() * 200),
          height: 50 + Math.floor(Math.random() * 300),
        },
        label: cls,
        metadata: {
          model: "anyware-detect-v1",
          engine: "AnywareAI",
        },
      });
    }
  }

  const processingTimeMs = performance.now() - start;
  inferenceCount++;
  totalLatencyMs += processingTimeMs;

  logger.debug(
    { cameraId, detections: detections.length, processingTimeMs },
    "AnywareAI frame analysis complete"
  );

  return {
    cameraId,
    timestamp: new Date().toISOString(),
    detections,
    processingTimeMs: parseFloat(processingTimeMs.toFixed(2)),
    engineVersion,
  };
}

export async function detectThreats(
  cameraId: string,
  frameData: Buffer | string
): Promise<DetectionResult[]> {
  const analysis = await analyzeFrame(cameraId, frameData, [
    "weapon",
    "fire",
    "smoke",
    "intrusion",
  ]);
  return analysis.detections;
}
