"use client";

import { useState } from "react";
import { Camera, Plus, Loader2, Wifi, WifiOff, MapPin, Eye } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { clsx } from "clsx";

interface CameraDevice {
  id: string;
  name: string;
  location: string;
  rtspUrl: string;
  status: string;
  resolution: string | null;
  fps: number | null;
  createdAt: string;
}

interface KnownFace {
  id: string;
  label: string;
  category: string;
  metadata: Record<string, unknown> | null;
}

const statusBadge: Record<string, string> = {
  online: "bg-green-500/10 text-green-400 border-green-500/30",
  offline: "bg-slate-700/30 text-slate-400 border-slate-600/30",
  error: "bg-red-500/10 text-red-400 border-red-500/30",
};

export default function CCTVPage() {
  const { token } = useAuth();
  const [tab, setTab] = useState<"cameras" | "faces">("cameras");
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    location: "",
    rtspUrl: "",
    resolution: "1920x1080",
    fps: "30",
  });

  const cameras = useApi<{ cameras: CameraDevice[]; total: number }>("/api/v1/cctv/cameras?limit=50");
  const faces = useApi<{ faces: KnownFace[]; total: number }>("/api/v1/cctv/faces?limit=50");

  async function addCamera(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setAdding(true);
    try {
      await api.post(
        "/api/v1/cctv/cameras",
        {
          name: addForm.name,
          location: addForm.location,
          rtspUrl: addForm.rtspUrl,
          resolution: addForm.resolution,
          fps: parseInt(addForm.fps),
        },
        token
      );
      cameras.refetch();
      setShowAdd(false);
      setAddForm({ name: "", location: "", rtspUrl: "", resolution: "1920x1080", fps: "30" });
    } finally {
      setAdding(false);
    }
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Camera className="h-7 w-7 text-brand-500" />
            CCTV Monitoring
          </h1>
          <p className="mt-1 text-sm text-slate-400">Manage cameras, streams, and known faces.</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 rounded-lg gradient-brand px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Add Camera
        </button>
      </div>

      {/* Add Camera Form */}
      {showAdd && (
        <form onSubmit={addCamera} className="card p-6 mb-8">
          <h3 className="text-sm font-semibold mb-4">New Camera</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <input
              required
              placeholder="Camera name"
              value={addForm.name}
              onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
              className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-brand-500"
            />
            <input
              required
              placeholder="Location"
              value={addForm.location}
              onChange={(e) => setAddForm((f) => ({ ...f, location: e.target.value }))}
              className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-brand-500"
            />
            <input
              required
              placeholder="rtsp://camera-ip:554/stream"
              value={addForm.rtspUrl}
              onChange={(e) => setAddForm((f) => ({ ...f, rtspUrl: e.target.value }))}
              className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-brand-500"
            />
          </div>
          <div className="mt-4 flex gap-3">
            <button
              type="submit"
              disabled={adding}
              className="rounded-lg gradient-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
            >
              {adding && <Loader2 className="h-4 w-4 animate-spin" />} Add Camera
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-400 hover:bg-slate-800"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-800 mb-6">
        {(["cameras", "faces"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              "px-4 py-2.5 text-sm font-medium capitalize border-b-2 -mb-px transition-colors",
              tab === t
                ? "border-brand-500 text-brand-400"
                : "border-transparent text-slate-500 hover:text-slate-300"
            )}
          >
            {t === "faces" ? "Known Faces" : t}
          </button>
        ))}
      </div>

      {/* Camera Grid */}
      {tab === "cameras" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cameras.data?.cameras?.map((cam) => (
            <div key={cam.id} className="card-hover overflow-hidden">
              {/* Simulated camera feed placeholder */}
              <div className="relative h-40 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                <Camera className="h-12 w-12 text-slate-700" />
                <div className="absolute top-3 left-3 flex items-center gap-1.5">
                  {cam.status === "online" ? (
                    <Wifi className="h-3.5 w-3.5 text-green-400" />
                  ) : (
                    <WifiOff className="h-3.5 w-3.5 text-slate-500" />
                  )}
                  <span
                    className={clsx(
                      "rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase",
                      statusBadge[cam.status] ?? statusBadge.offline
                    )}
                  >
                    {cam.status}
                  </span>
                </div>
                {cam.status === "online" && (
                  <div className="absolute top-3 right-3">
                    <div className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-medium text-sm">{cam.name}</h3>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                  <MapPin className="h-3 w-3" /> {cam.location}
                </div>
                <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                  <span>{cam.resolution || "—"}</span>
                  <span>{cam.fps ? `${cam.fps} fps` : ""}</span>
                </div>
              </div>
            </div>
          )) ?? (
            <div className="col-span-full py-12 text-center text-slate-500">
              {cameras.loading ? (
                <Loader2 className="h-5 w-5 animate-spin mx-auto" />
              ) : (
                "No cameras configured. Click 'Add Camera' to get started."
              )}
            </div>
          )}
        </div>
      )}

      {/* Known Faces */}
      {tab === "faces" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {faces.data?.faces?.map((face) => (
            <div key={face.id} className="card-hover p-4">
              <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-800 mx-auto">
                <Eye className="h-7 w-7 text-slate-600" />
              </div>
              <div className="text-center">
                <div className="font-medium text-sm">{face.label}</div>
                <div className="mt-1 text-xs text-slate-500 capitalize">{face.category}</div>
              </div>
            </div>
          )) ?? (
            <div className="col-span-full py-12 text-center text-slate-500">
              {faces.loading ? (
                <Loader2 className="h-5 w-5 animate-spin mx-auto" />
              ) : (
                "No known faces registered."
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
