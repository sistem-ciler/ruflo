"use client";

import { useState } from "react";
import { Users, Plus, Loader2, Shield, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { clsx } from "clsx";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
  lastLogin: string | null;
  createdAt: string;
}

const roleBadge: Record<string, string> = {
  owner: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  admin: "bg-brand-500/10 text-brand-400 border-brand-500/20",
  operator: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  viewer: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

export default function UsersPage() {
  const { token, user: me } = useAuth();
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "viewer",
  });

  const users = useApi<{ users: User[]; total: number }>("/api/v1/users?limit=50");

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setAdding(true);
    try {
      await api.post("/api/v1/users", addForm, token);
      users.refetch();
      setShowAdd(false);
      setAddForm({ name: "", email: "", password: "", role: "viewer" });
    } finally {
      setAdding(false);
    }
  }

  async function deleteUser(id: string) {
    if (!token || id === me?.id) return;
    if (!confirm("Remove this user?")) return;
    await api.del(`/api/v1/users/${id}`, token);
    users.refetch();
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Users className="h-7 w-7 text-brand-500" />
            User Management
          </h1>
          <p className="mt-1 text-sm text-slate-400">Manage team members and their access roles.</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 rounded-lg gradient-brand px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Add User
        </button>
      </div>

      {/* Add User Form */}
      {showAdd && (
        <form onSubmit={addUser} className="card p-6 mb-8">
          <h3 className="text-sm font-semibold mb-4">New Team Member</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <input
              required
              placeholder="Full name"
              value={addForm.name}
              onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
              className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-brand-500"
            />
            <input
              required
              type="email"
              placeholder="Email address"
              value={addForm.email}
              onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
              className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-brand-500"
            />
            <input
              required
              type="password"
              placeholder="Password"
              minLength={8}
              value={addForm.password}
              onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
              className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-brand-500"
            />
            <select
              value={addForm.role}
              onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value }))}
              className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
            >
              <option value="viewer">Viewer</option>
              <option value="operator">Operator</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              type="submit"
              disabled={adding}
              className="rounded-lg gradient-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
            >
              {adding && <Loader2 className="h-4 w-4 animate-spin" />} Add User
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

      {/* User List */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-xs text-slate-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3 hidden lg:table-cell">Permissions</th>
              <th className="px-4 py-3">Last Login</th>
              <th className="px-4 py-3 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {users.data?.users?.map((u) => (
              <tr key={u.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-950/60 text-brand-400 text-xs font-semibold">
                      {u.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </div>
                    <span className="text-slate-200">{u.name}</span>
                    {u.id === me?.id && (
                      <span className="rounded-full bg-brand-500/10 px-1.5 py-0.5 text-[10px] text-brand-400">
                        You
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-400">{u.email}</td>
                <td className="px-4 py-3">
                  <span
                    className={clsx(
                      "rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
                      roleBadge[u.role] ?? roleBadge.viewer
                    )}
                  >
                    {u.role === "owner" && <Shield className="inline h-3 w-3 mr-1" />}
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {u.permissions?.slice(0, 3).map((p) => (
                      <span key={p} className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-500">
                        {p}
                      </span>
                    ))}
                    {(u.permissions?.length ?? 0) > 3 && (
                      <span className="text-[10px] text-slate-600">+{u.permissions.length - 3}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {u.lastLogin ? new Date(u.lastLogin).toLocaleString() : "Never"}
                </td>
                <td className="px-4 py-3">
                  {u.id !== me?.id && (
                    <button
                      onClick={() => deleteUser(u.id)}
                      className="rounded p-1.5 text-slate-600 hover:bg-red-950/30 hover:text-red-400 transition-colors"
                      title="Remove user"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            )) ?? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                  {users.loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : "No team members found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
