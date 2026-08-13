import { useState, useEffect } from "react";
import {
  Users, FileText, Flag, UserPlus, Activity, Server, Search, Ban, Pause,
  Trash2, BadgeCheck, UserX, UserCheck, Pin, Star, CheckCircle, XCircle,
  Bell, BarChart3, Image, Shield, ScrollText,
  MapPin, Hexagon, Bot, Send, Save, TrendingUp, Heart, MessageCircle, Repeat2,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import HivezLoader from "@/components/common/HivezLoader";
import {
  getDashboardStats, subscribeToUsers, subscribeToPosts, subscribeToReports,
  searchUsers, banUser, unbanUser, suspendUser, unsuspendUser,
  verifyUser, unverifyUser, deleteUser, deletePost, featurePost, pinPost,
  resolveReport, dismissReport, getAnalytics, getMediaStats,
  sendBroadcastNotification, getBroadcasts, getAdmins, setUserRole,
  getSettings, saveSettings, getLogs, logAdminAction,
} from "../../services/admin";
import type { AdminUser, AdminPost, AdminReport, AdminSettings } from "../../services/admin";
import { toast } from "sonner";

function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-black tracking-tight text-white">{title}</h1>
      <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-zinc-800 bg-zinc-900 p-5 ${className}`}>{children}</div>;
}

function Spinner() {
  return (
    <div className="flex h-64 items-center justify-center">
      <HivezLoader size="md" progress={58} label="Loading admin data" />
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: any; message: string }) {
  return (
    <Card className="p-12 text-center">
      <Icon className="mx-auto mb-3 h-10 w-10 text-zinc-600" />
      <p className="text-sm text-zinc-500">{message}</p>
    </Card>
  );
}

function ActionBtn({ icon: Icon, label, color, onClick }: { icon: any; label: string; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} title={label} className="rounded-lg p-1.5 transition hover:bg-zinc-700">
      <Icon size={16} className={color} />
    </button>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <Card>
      <div className={`mb-3 inline-flex rounded-xl ${color} p-2.5`}>
        <Icon size={20} className="text-white" />
      </div>
      <p className="text-3xl font-black text-white">{value.toLocaleString()}</p>
      <p className="mt-1 text-xs text-zinc-400">{label}</p>
    </Card>
  );
}

function BarChart({ data, color }: { data: { date: string; count: number }[]; color: string }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-2" style={{ height: 160 }}>
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-2">
          <div className="flex w-full flex-1 items-end">
            <div className={`w-full rounded-t-md ${color} transition-all`} style={{ height: `${(d.count / max) * 100}%`, minHeight: 2 }} />
          </div>
          <span className="text-[10px] text-zinc-500">{d.date}</span>
        </div>
      ))}
    </div>
  );
}

export function AdminDashboard() {
  const [stats, setStats] = useState({ totalUsers: 0, activeUsers: 0, newSignups: 0, totalPosts: 0, pendingReports: 0 });
  const [recentUsers, setRecentUsers] = useState<AdminUser[]>([]);
  const [recentPosts, setRecentPosts] = useState<AdminPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboardStats().then((s) => { setStats(s); setLoading(false); });
    const u1 = subscribeToUsers((u) => setRecentUsers(u.slice(0, 5)));
    const u2 = subscribeToPosts((p) => setRecentPosts(p.slice(0, 5)));
    return () => { u1(); u2(); };
  }, []);

  if (loading) return <div className="min-h-full bg-zinc-950 p-6"><Spinner /></div>;

  return (
    <div className="min-h-full bg-zinc-950 p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <PageHeader title="Dashboard" subtitle="Overview of your Hivez platform" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Total Users" value={stats.totalUsers} icon={Users} color="bg-blue-500" />
          <StatCard label="Active Users" value={stats.activeUsers} icon={Activity} color="bg-green-500" />
          <StatCard label="New Signups" value={stats.newSignups} icon={UserPlus} color="bg-purple-500" />
          <StatCard label="Total Posts" value={stats.totalPosts} icon={FileText} color="bg-amber-500" />
          <StatCard label="Reports Pending" value={stats.pendingReports} icon={Flag} color="bg-red-500" />
        </div>
        <Card className="mt-6">
          <div className="mb-4 flex items-center gap-2"><Server size={18} className="text-green-500" /><h2 className="text-sm font-bold">System Status</h2></div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[["API", "Operational"], ["Database", "Connected"], ["Storage", "Operational"], ["Auth", "Active"]].map(([l, s]) => (
              <div key={l} className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <div><p className="text-xs text-zinc-500">{l}</p><p className="text-xs font-semibold text-green-500">{s}</p></div>
              </div>
            ))}
          </div>
        </Card>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="mb-4 text-sm font-bold">Recent Users</h2>
            <div className="space-y-3">
              {recentUsers.length === 0 ? <p className="text-sm text-zinc-500">No users yet.</p> : recentUsers.map((u) => (
                <div key={u.uid} className="flex items-center gap-3">
                  <img src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName || u.email}&background=27272a&color=fff`} alt="" className="h-9 w-9 rounded-full object-cover" />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{u.displayName || u.email}</p><p className="truncate text-xs text-zinc-500">@{u.username || "unknown"}</p></div>
                  {u.verified && <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-400">Verified</span>}
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <h2 className="mb-4 text-sm font-bold">Recent Posts</h2>
            <div className="space-y-3">
              {recentPosts.length === 0 ? <p className="text-sm text-zinc-500">No posts yet.</p> : recentPosts.map((p) => (
                <div key={p.id} className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800"><FileText size={16} className="text-zinc-400" /></div>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{p.caption || "No caption"}</p><p className="truncate text-xs text-zinc-500">@{p.username} - {p.likes || 0} likes</p></div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function AdminUsers() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [filtered, setFiltered] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    const unsub = subscribeToUsers((data) => { setUsers(data); setFiltered(data); setLoading(false); });
    return unsub;
  }, []);

  useEffect(() => {
    let r = users;
    if (filter === "banned") r = users.filter((u) => u.banned);
    else if (filter === "suspended") r = users.filter((u) => u.suspended);
    else if (filter === "verified") r = users.filter((u) => u.verified);
    else if (filter === "unverified") r = users.filter((u) => !u.verified);
    setFiltered(r);
  }, [filter, users]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!search.trim()) { setFiltered(users); return; }
    setLoading(true);
    setFiltered(await searchUsers(search));
    setLoading(false);
  }

  async function act(fn: () => Promise<void>, msg: string, action?: string, uid?: string) {
    try { await fn(); if (action && uid && user) await logAdminAction({ adminId: user.uid, adminName: user.email || "Admin", action, target: uid }); toast.success(msg); }
    catch (err: any) { toast.error(err.message); }
  }

  const filters = [["all", "All"], ["banned", "Banned"], ["suspended", "Suspended"], ["verified", "Verified"], ["unverified", "Unverified"]] as const;

  return (
    <div className="min-h-full bg-zinc-950 p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <PageHeader title="User Management" subtitle="Manage all users on the platform" />
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <form onSubmit={handleSearch} className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, username..." className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-2.5 pl-10 pr-4 text-sm text-white outline-none focus:border-zinc-600" />
          </form>
          <div className="flex gap-2 overflow-x-auto">
            {filters.map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition ${filter === k ? "bg-white text-black" : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"}`}>{l}</button>
            ))}
          </div>
        </div>
        {loading ? <Spinner /> : filtered.length === 0 ? <EmptyState icon={UserX} message="No users found." /> : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
                <tr><th className="px-4 py-3 font-medium">User</th><th className="px-4 py-3 font-medium">Email</th><th className="px-4 py-3 font-medium">Posts</th><th className="px-4 py-3 font-medium">Followers</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filtered.map((u) => (
                  <tr key={u.uid} className="hover:bg-zinc-800/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName || u.email}&background=27272a&color=fff`} alt="" className="h-9 w-9 rounded-full object-cover" />
                        <div><p className="font-medium">{u.displayName || "Unknown"}</p><p className="text-xs text-zinc-500">@{u.username || "unknown"}</p></div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{u.email}</td>
                    <td className="px-4 py-3 text-zinc-400">{u.posts || 0}</td>
                    <td className="px-4 py-3 text-zinc-400">{u.followers || 0}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.verified && <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-400">Verified</span>}
                        {u.banned && <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-400">Banned</span>}
                        {u.suspended && <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400">Suspended</span>}
                        {!u.verified && !u.banned && !u.suspended && <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-[10px] font-bold text-zinc-400">Active</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.verified ? <ActionBtn icon={BadgeCheck} label="Unverify" color="text-zinc-400" onClick={() => act(() => unverifyUser(u.uid), "Unverified")} /> : <ActionBtn icon={BadgeCheck} label="Verify" color="text-sky-400" onClick={() => act(() => verifyUser(u.uid), "Verified", "verify_user", u.uid)} />}
                        {u.banned ? <ActionBtn icon={UserCheck} label="Unban" color="text-green-400" onClick={() => act(() => unbanUser(u.uid), "Unbanned", "unban_user", u.uid)} /> : <ActionBtn icon={Ban} label="Ban" color="text-red-400" onClick={() => act(() => banUser(u.uid), "Banned", "ban_user", u.uid)} />}
                        {u.suspended ? <ActionBtn icon={UserCheck} label="Unsuspend" color="text-green-400" onClick={() => act(() => unsuspendUser(u.uid), "Unsuspended")} /> : <ActionBtn icon={Pause} label="Suspend" color="text-amber-400" onClick={() => act(() => suspendUser(u.uid), "Suspended", "suspend_user", u.uid)} />}
                        <ActionBtn icon={Trash2} label="Delete" color="text-red-400" onClick={() => { if (confirm("Delete this user?")) act(() => deleteUser(u.uid), "Deleted", "delete_user", u.uid); }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}

export function AdminPosts() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToPosts((data) => { setPosts(data); setLoading(false); });
    return unsub;
  }, []);

  async function act(fn: () => Promise<void>, msg: string, action: string, id: string) {
    try { await fn(); if (user) await logAdminAction({ adminId: user.uid, adminName: user.email || "Admin", action, target: id }); toast.success(msg); }
    catch (err: any) { toast.error(err.message); }
  }

  return (
    <div className="min-h-full bg-zinc-950 p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <PageHeader title="Posts" subtitle="Manage all posts on the platform" />
        {loading ? <Spinner /> : posts.length === 0 ? <EmptyState icon={FileText} message="No posts found." /> : (
          <div className="space-y-3">
            {posts.map((p) => (
              <Card key={p.id}>
                <div className="flex items-start gap-3">
                  <img src={p.photoURL || `https://ui-avatars.com/api/?name=${p.displayName || p.username}&background=27272a&color=fff`} alt="" className="h-10 w-10 rounded-full object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{p.displayName || p.username}</p>
                      {p.verified && <BadgeCheck size={14} className="text-sky-500" />}
                      <span className="text-xs text-zinc-500">@{p.username}</span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-300">{p.caption || "No caption"}</p>
                    <div className="mt-2 flex items-center gap-4 text-xs text-zinc-500">
                      <span className="flex items-center gap-1"><Heart size={12} /> {p.likes || 0}</span>
                      <span className="flex items-center gap-1"><MessageCircle size={12} /> {p.comments || 0}</span>
                      <span className="flex items-center gap-1"><Repeat2 size={12} /> {p.shares || 0}</span>
                      {p.category && <span className="rounded-full bg-zinc-800 px-2 py-0.5">{p.category}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <ActionBtn icon={Star} label={p.featured ? "Unfeature" : "Feature"} color={p.featured ? "text-amber-400" : "text-zinc-400"} onClick={() => act(() => featurePost(p.id, !p.featured), p.featured ? "Unfeatured" : "Featured", "feature_post", p.id)} />
                    <ActionBtn icon={Pin} label={p.pinned ? "Unpin" : "Pin"} color={p.pinned ? "text-green-400" : "text-zinc-400"} onClick={() => act(() => pinPost(p.id, !p.pinned), p.pinned ? "Unpinned" : "Pinned", "pin_post", p.id)} />
                    <ActionBtn icon={Trash2} label="Delete" color="text-red-400" onClick={() => { if (confirm("Delete this post?")) act(() => deletePost(p.id), "Deleted", "delete_post", p.id); }} />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminReports() {
  const { user } = useAuth();
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    const unsub = subscribeToReports((data) => { setReports(data); setLoading(false); });
    return unsub;
  }, []);

  const filtered = filter === "all" ? reports : reports.filter((r) => (r.status || "pending") === filter);

  async function act(fn: () => Promise<void>, msg: string, action: string, id: string) {
    try { await fn(); if (user) await logAdminAction({ adminId: user.uid, adminName: user.email || "Admin", action, target: id }); toast.success(msg); }
    catch (err: any) { toast.error(err.message); }
  }

  const filters = [["all", "All"], ["pending", "Pending"], ["resolved", "Resolved"], ["dismissed", "Dismissed"]] as const;

  return (
    <div className="min-h-full bg-zinc-950 p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <PageHeader title="Reports & Moderation" subtitle="Review reported content and user reports" />
        <div className="mb-6 flex gap-2 overflow-x-auto">
          {filters.map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition ${filter === k ? "bg-white text-black" : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"}`}>{l}</button>
          ))}
        </div>
        {loading ? <Spinner /> : filtered.length === 0 ? <EmptyState icon={Flag} message="No reports found." /> : (
          <div className="space-y-3">
            {filtered.map((r) => (
              <Card key={r.id}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${(r.status || "pending") === "pending" ? "bg-amber-500/20 text-amber-400" : r.status === "resolved" ? "bg-green-500/20 text-green-400" : "bg-zinc-700 text-zinc-400"}`}>{(r.status || "pending").toUpperCase()}</span>
                      <span className="text-xs text-zinc-500">{r.targetType}</span>
                    </div>
                    <p className="mt-2 text-sm text-zinc-300">{r.reason}</p>
                    <p className="mt-1 text-xs text-zinc-500">Reported by {r.reporterName || r.reporterId}</p>
                  </div>
                  {r.status === "pending" && (
                    <div className="flex gap-1">
                      <ActionBtn icon={CheckCircle} label="Resolve" color="text-green-400" onClick={() => act(() => resolveReport(r.id), "Resolved", "resolve_report", r.id)} />
                      <ActionBtn icon={XCircle} label="Dismiss" color="text-zinc-400" onClick={() => act(() => dismissReport(r.id), "Dismissed", "dismiss_report", r.id)} />
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminIssues() {
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    subscribeToReports((data) => { setReports(data); setLoading(false); });
  }, []);

  return (
    <div className="min-h-full bg-zinc-950 p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <PageHeader title="Issues Map" subtitle="Geographic overview of reported issues" />
        {loading ? <Spinner /> : (
          <Card className="flex h-96 items-center justify-center">
            <div className="text-center">
              <MapPin className="mx-auto mb-3 h-12 w-12 text-zinc-600" />
              <p className="text-sm text-zinc-500">{reports.length} reports across the platform</p>
              <p className="mt-1 text-xs text-zinc-600">Map integration requires Google Maps API key</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

export function AdminHives() {
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToPosts((data) => { setPosts(data); setLoading(false); });
    return unsub;
  }, []);

  const hives: Record<string, number> = {};
  posts.forEach((p) => { if (p.category) hives[p.category] = (hives[p.category] || 0) + 1; });
  const sorted = Object.entries(hives).sort((a, b) => b[1] - a[1]);

  return (
    <div className="min-h-full bg-zinc-950 p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <PageHeader title="Hives" subtitle="Manage community categories and hives" />
        {loading ? <Spinner /> : sorted.length === 0 ? <EmptyState icon={Hexagon} message="No hives found." /> : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map(([name, count]) => (
              <Card key={name}>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500"><Hexagon size={20} className="text-black" /></div>
                  <div><p className="font-bold capitalize">{name}</p><p className="text-xs text-zinc-400">{count} posts</p></div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminAIQueue() {
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    subscribeToReports((data) => { setReports(data.filter((r) => (r.status || "pending") === "pending")); setLoading(false); });
  }, []);

  return (
    <div className="min-h-full bg-zinc-950 p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <PageHeader title="AI Review Queue" subtitle="AI-assisted content moderation queue" />
        {loading ? <Spinner /> : reports.length === 0 ? <EmptyState icon={Bot} message="Queue is empty. All clear!" /> : (
          <div className="space-y-3">
            {reports.map((r) => (
              <Card key={r.id}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2"><Bot size={16} className="text-purple-400" /><span className="text-sm font-medium">{r.targetType}</span></div>
                    <p className="mt-2 text-sm text-zinc-300">{r.reason}</p>
                  </div>
                  <div className="flex gap-1">
                    <ActionBtn icon={CheckCircle} label="Approve" color="text-green-400" onClick={() => resolveReport(r.id).then(() => toast.success("Approved"))} />
                    <ActionBtn icon={XCircle} label="Reject" color="text-red-400" onClick={() => dismissReport(r.id).then(() => toast.success("Rejected"))} />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminNotifications() {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    getBroadcasts().then((b) => { setBroadcasts(b); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim() || !user) return;
    setSending(true);
    try {
      await sendBroadcastNotification({ title, body, adminId: user.uid, adminName: user.email || "Admin" });
      await logAdminAction({ adminId: user.uid, adminName: user.email || "Admin", action: "broadcast", target: "all_users", details: title });
      toast.success("Broadcast sent to all users");
      setTitle(""); setBody("");
      const b = await getBroadcasts(); setBroadcasts(b);
    } catch (err: any) { toast.error(err.message); }
    setSending(false);
  }

  return (
    <div className="min-h-full bg-zinc-950 p-6 text-white">
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Push Notifications" subtitle="Send broadcast notifications to all users" />
        <Card>
          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Notification title" className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-white outline-none focus:border-zinc-600" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Message</label>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Notification message" rows={3} className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-white outline-none focus:border-zinc-600 resize-none" />
            </div>
            <button type="submit" disabled={sending} className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-50">
              <Send size={16} /> {sending ? "Sending..." : "Send Broadcast"}
            </button>
          </form>
        </Card>
        <div className="mt-6">
          <h2 className="mb-4 text-sm font-bold">Recent Broadcasts</h2>
          {loading ? <Spinner /> : broadcasts.length === 0 ? <EmptyState icon={Bell} message="No broadcasts sent yet." /> : (
            <div className="space-y-3">
              {broadcasts.map((b) => (
                <Card key={b.id}>
                  <p className="text-sm font-medium">{b.title}</p>
                  <p className="mt-1 text-sm text-zinc-400">{b.body}</p>
                  <p className="mt-2 text-xs text-zinc-600">By {b.adminName}</p>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AdminAnalytics() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAnalytics().then((d) => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="min-h-full bg-zinc-950 p-6"><Spinner /></div>;
  if (!data) return <div className="min-h-full bg-zinc-950 p-6"><EmptyState icon={BarChart3} message="No analytics data available." /></div>;

  return (
    <div className="min-h-full bg-zinc-950 p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <PageHeader title="Analytics" subtitle="Platform engagement and growth metrics" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total Users" value={data.totalUsers} icon={Users} color="bg-blue-500" />
          <StatCard label="Total Posts" value={data.totalPosts} icon={FileText} color="bg-amber-500" />
          <StatCard label="Total Likes" value={data.totalLikes} icon={Heart} color="bg-red-500" />
          <StatCard label="Total Comments" value={data.totalComments} icon={MessageCircle} color="bg-green-500" />
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card><h2 className="mb-4 text-sm font-bold">Daily Active Users (7d)</h2><BarChart data={data.dau} color="bg-green-500" /></Card>
          <Card><h2 className="mb-4 text-sm font-bold">New Registrations (7d)</h2><BarChart data={data.registrations} color="bg-purple-500" /></Card>
          <Card><h2 className="mb-4 text-sm font-bold">Posts Per Day (7d)</h2><BarChart data={data.postsPerDay} color="bg-amber-500" /></Card>
          <Card>
            <h2 className="mb-4 text-sm font-bold">Popular Posts</h2>
            <div className="space-y-3">
              {data.popularPosts.map((p: any) => (
                <div key={p.id} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800"><TrendingUp size={14} className="text-zinc-400" /></div>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm">{p.caption || "No caption"}</p><p className="text-xs text-zinc-500">{p.likes || 0} likes</p></div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function AdminMedia() {
  const [stats, setStats] = useState({ totalMedia: 0, videoCount: 0, imageCount: 0, totalPosts: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMediaStats().then((s) => { setStats(s); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="min-h-full bg-zinc-950 p-6"><Spinner /></div>;

  return (
    <div className="min-h-full bg-zinc-950 p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <PageHeader title="Media Management" subtitle="Manage uploaded images and videos" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total Media" value={stats.totalMedia} icon={Image} color="bg-blue-500" />
          <StatCard label="Images" value={stats.imageCount} icon={Image} color="bg-green-500" />
          <StatCard label="Videos" value={stats.videoCount} icon={FileText} color="bg-purple-500" />
          <StatCard label="Posts with Media" value={stats.totalPosts} icon={FileText} color="bg-amber-500" />
        </div>
        <Card className="mt-6">
          <div className="flex items-center gap-2"><Image size={18} className="text-zinc-400" /><h2 className="text-sm font-bold">Storage Usage</h2></div>
          <p className="mt-2 text-sm text-zinc-400">Media is stored in Firebase Storage. Use the Firebase Console to manage storage directly.</p>
        </Card>
      </div>
    </div>
  );
}

export function AdminRoles() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdmins().then((a) => { setAdmins(a); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  async function handleRole(uid: string, role: string) {
    try { await setUserRole(uid, role); if (user) await logAdminAction({ adminId: user.uid, adminName: user.email || "Admin", action: "set_role", target: uid, details: role }); toast.success(`Role set to ${role}`); const a = await getAdmins(); setAdmins(a); }
    catch (err: any) { toast.error(err.message); }
  }

  return (
    <div className="min-h-full bg-zinc-950 p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <PageHeader title="Admins & Roles" subtitle="Manage admin team members and permissions" />
        {loading ? <Spinner /> : admins.length === 0 ? <EmptyState icon={Shield} message="No admins found. Set a user's role to 'admin' in the Users page." /> : (
          <div className="space-y-3">
            {admins.map((a) => (
              <Card key={a.uid}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img src={a.photoURL || `https://ui-avatars.com/api/?name=${a.displayName || a.email}&background=27272a&color=fff`} alt="" className="h-10 w-10 rounded-full object-cover" />
                    <div><p className="font-medium">{a.displayName || a.email}</p><p className="text-xs text-zinc-500">@{a.username || "unknown"}</p></div>
                  </div>
                  <select value={a.role || "user"} onChange={(e) => handleRole(a.uid, e.target.value)} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-sm text-white outline-none">
                    <option value="admin">Admin</option>
                    <option value="moderator">Moderator</option>
                    <option value="editor">Editor</option>
                    <option value="user">User</option>
                  </select>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { getSettings().then((s) => { setSettings(s); setLoading(false); }).catch(() => setLoading(false)); }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!settings || !user) return;
    setSaving(true);
    try { await saveSettings(settings); await logAdminAction({ adminId: user.uid, adminName: user.email || "Admin", action: "save_settings", target: "app" }); toast.success("Settings saved"); }
    catch (err: any) { toast.error(err.message); }
    setSaving(false);
  }

  if (loading || !settings) return <div className="min-h-full bg-zinc-950 p-6"><Spinner /></div>;

  const toggles: [keyof AdminSettings, string][] = [
    ["maintenanceMode", "Maintenance Mode"], ["signupEnabled", "Signups Enabled"], ["emailNotifications", "Email Notifications"],
    ["aiModeration", "AI Moderation"], ["autoTagging", "Auto Tagging"], ["spamDetection", "Spam Detection"], ["allowVideo", "Allow Video"],
  ];

  return (
    <div className="min-h-full bg-zinc-950 p-6 text-white">
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Settings" subtitle="Configure your Hivez platform" />
        <form onSubmit={handleSave} className="space-y-6">
          <Card>
            <h2 className="mb-4 text-sm font-bold">General</h2>
            <div className="space-y-4">
              <div><label className="mb-1.5 block text-xs font-medium text-zinc-400">Site Name</label><input value={settings.siteName} onChange={(e) => setSettings({ ...settings, siteName: e.target.value })} className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-white outline-none focus:border-zinc-600" /></div>
              <div><label className="mb-1.5 block text-xs font-medium text-zinc-400">Site Logo URL</label><input value={settings.siteLogo} onChange={(e) => setSettings({ ...settings, siteLogo: e.target.value })} placeholder="https://..." className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-white outline-none focus:border-zinc-600" /></div>
              <div><label className="mb-1.5 block text-xs font-medium text-zinc-400">Max Post Size (MB)</label><input type="number" value={settings.maxPostSize} onChange={(e) => setSettings({ ...settings, maxPostSize: parseInt(e.target.value) || 10 })} className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-white outline-none focus:border-zinc-600" /></div>
            </div>
          </Card>
          <Card>
            <h2 className="mb-4 text-sm font-bold">Feature Toggles</h2>
            <div className="space-y-3">
              {toggles.map(([key, label]) => (
                <label key={key} className="flex cursor-pointer items-center justify-between">
                  <span className="text-sm text-zinc-300">{label}</span>
                  <button type="button" onClick={() => setSettings({ ...settings, [key]: !settings[key] })} className={`relative h-6 w-11 rounded-full transition ${settings[key] ? "bg-green-500" : "bg-zinc-700"}`}>
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${settings[key] ? "left-5" : "left-0.5"}`} />
                  </button>
                </label>
              ))}
            </div>
          </Card>
          <button type="submit" disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-50">
            <Save size={16} /> {saving ? "Saving..." : "Save Settings"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function AdminLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLogs().then((l) => { setLogs(l); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-full bg-zinc-950 p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <PageHeader title="Activity Logs" subtitle="Audit trail of admin actions" />
        {loading ? <Spinner /> : logs.length === 0 ? <EmptyState icon={ScrollText} message="No activity logs yet." /> : (
          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
                <tr><th className="px-4 py-3 font-medium">Admin</th><th className="px-4 py-3 font-medium">Action</th><th className="px-4 py-3 font-medium">Target</th><th className="px-4 py-3 font-medium">Details</th></tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {logs.map((l) => (
                  <tr key={l.id} className="hover:bg-zinc-800/50">
                    <td className="px-4 py-3 text-zinc-300">{l.adminName}</td>
                    <td className="px-4 py-3"><span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-300">{l.action}</span></td>
                    <td className="px-4 py-3 text-zinc-400 font-mono text-xs">{l.target}</td>
                    <td className="px-4 py-3 text-zinc-400">{l.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}
