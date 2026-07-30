import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot,
  QueryConstraint,
} from "firebase/firestore";
import type { DocumentData } from "firebase/firestore";
import { db } from "../firebase/firebase";

export interface AdminUser {
  uid: string;
  email: string;
  displayName: string;
  username: string;
  bio: string;
  photoURL: string;
  profileCompleted: boolean;
  verified: boolean;
  banned: boolean;
  suspended: boolean;
  role: string;
  followers: number;
  following: number;
  posts: number;
  createdAt: any;
  lastSeen: any;
}

export interface AdminPost {
  id: string;
  uid: string;
  username: string;
  displayName: string;
  photoURL: string;
  verified: boolean;
  caption: string;
  mediaUrl: string;
  mediaUrls?: string[];
  mediaItems?: any[];
  mediaType: string;
  likes: number;
  comments: number;
  shares: number;
  createdAt: any;
  category?: string;
  hashtags?: string[];
  location?: string | null;
  featured?: boolean;
  pinned?: boolean;
}

export interface AdminReport {
  id: string;
  reporterId: string;
  reporterName: string;
  targetId: string;
  targetType: string;
  reason: string;
  status: string;
  createdAt: any;
}

export interface AdminLog {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  target: string;
  details: string;
  createdAt: any;
}

export interface AdminSettings {
  siteName: string;
  siteLogo: string;
  maintenanceMode: boolean;
  signupEnabled: boolean;
  emailNotifications: boolean;
  aiModeration: boolean;
  autoTagging: boolean;
  spamDetection: boolean;
  maxPostSize: number;
  allowVideo: boolean;
}

export async function checkIsAdmin(uid: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return false;
    const data = snap.data();
    return data.role === "admin" || data.isAdmin === true;
  } catch {
    return false;
  }
}

export async function logAdminAction(params: {
  adminId: string;
  adminName: string;
  action: string;
  target: string;
  details?: string;
}) {
  try {
    const logRef = doc(collection(db, "admin_logs"));
    await setDoc(logRef, {
      adminId: params.adminId,
      adminName: params.adminName,
      action: params.action,
      target: params.target,
      details: params.details || "",
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("Failed to log admin action:", err);
  }
}

export async function getDashboardStats() {
  const [usersSnap, postsSnap, reportsSnap] = await Promise.all([
    getDocs(collection(db, "users")),
    getDocs(collection(db, "posts")),
    getDocs(collection(db, "reports")),
  ]);

  const totalUsers = usersSnap.size;
  const totalPosts = postsSnap.size;
  const pendingReports = reportsSnap.docs.filter(
    (d) => (d.data().status || "pending") === "pending"
  ).length;

  let activeUsers = 0;
  let newSignups = 0;
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  usersSnap.forEach((d) => {
    const data = d.data();
    if (data.lastSeen?.toDate) {
      if (data.lastSeen.toDate().getTime() > weekAgo) activeUsers++;
    }
    if (data.createdAt?.toDate) {
      if (data.createdAt.toDate().getTime() > dayAgo) newSignups++;
    }
  });

  return { totalUsers, activeUsers, newSignups, totalPosts, pendingReports };
}

export async function getAllUsers(constraints: QueryConstraint[] = []): Promise<AdminUser[]> {
  const q = query(collection(db, "users"), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ uid: d.id, ...(d.data() as DocumentData) })) as AdminUser[];
}

export async function searchUsers(searchTerm: string): Promise<AdminUser[]> {
  const snap = await getDocs(collection(db, "users"));
  const term = searchTerm.toLowerCase();
  return snap.docs
    .map((d) => ({ uid: d.id, ...(d.data() as DocumentData) }))
    .filter((u: any) => {
      return (
        u.username?.toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term) ||
        u.displayName?.toLowerCase().includes(term)
      );
    }) as AdminUser[];
}

export async function banUser(uid: string) {
  await updateDoc(doc(db, "users", uid), { banned: true, suspended: false });
}

export async function unbanUser(uid: string) {
  await updateDoc(doc(db, "users", uid), { banned: false, suspended: false });
}

export async function suspendUser(uid: string) {
  await updateDoc(doc(db, "users", uid), { suspended: true });
}

export async function unsuspendUser(uid: string) {
  await updateDoc(doc(db, "users", uid), { suspended: false });
}

export async function verifyUser(uid: string) {
  await updateDoc(doc(db, "users", uid), { verified: true });
}

export async function unverifyUser(uid: string) {
  await updateDoc(doc(db, "users", uid), { verified: false });
}

export async function deleteUser(uid: string) {
  await deleteDoc(doc(db, "users", uid));
}

export async function updateUserField(uid: string, field: string, value: any) {
  await updateDoc(doc(db, "users", uid), { [field]: value });
}

export async function setUserRole(uid: string, role: string) {
  await updateDoc(doc(db, "users", uid), { role });
}

export async function getAllPosts(constraints: QueryConstraint[] = []): Promise<AdminPost[]> {
  const q = query(collection(db, "posts"), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as DocumentData) })) as AdminPost[];
}

export async function deletePost(postId: string) {
  await deleteDoc(doc(db, "posts", postId));
}

export async function featurePost(postId: string, featured: boolean) {
  await updateDoc(doc(db, "posts", postId), { featured });
}

export async function pinPost(postId: string, pinned: boolean) {
  await updateDoc(doc(db, "posts", postId), { pinned });
}

export async function getAllReports(constraints: QueryConstraint[] = []): Promise<AdminReport[]> {
  const q = query(collection(db, "reports"), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as DocumentData) })) as AdminReport[];
}

export async function resolveReport(reportId: string) {
  await updateDoc(doc(db, "reports", reportId), { status: "resolved" });
}

export async function dismissReport(reportId: string) {
  await updateDoc(doc(db, "reports", reportId), { status: "dismissed" });
}

export async function createReport(data: { reporterId: string; reporterName: string; targetId: string; targetType: string; reason: string }) {
  const ref = doc(collection(db, "reports"));
  await setDoc(ref, { ...data, status: "pending", createdAt: serverTimestamp() });
}

export async function getAnalytics() {
  const [usersSnap, postsSnap] = await Promise.all([
    getDocs(collection(db, "users")),
    getDocs(collection(db, "posts")),
  ]);

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const dau: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = now - i * dayMs;
    const dayEnd = dayStart - dayMs;
    let count = 0;
    usersSnap.forEach((d) => {
      const data = d.data();
      if (data.lastSeen?.toDate) { const t = data.lastSeen.toDate().getTime(); if (t <= dayStart && t > dayEnd) count++; }
    });
    dau.push({ date: new Date(dayStart).toLocaleDateString("en", { weekday: "short" }), count });
  }

  const registrations: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = now - i * dayMs;
    const dayEnd = dayStart - dayMs;
    let count = 0;
    usersSnap.forEach((d) => {
      const data = d.data();
      if (data.createdAt?.toDate) { const t = data.createdAt.toDate().getTime(); if (t <= dayStart && t > dayEnd) count++; }
    });
    registrations.push({ date: new Date(dayStart).toLocaleDateString("en", { weekday: "short" }), count });
  }

  const postsPerDay: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = now - i * dayMs;
    const dayEnd = dayStart - dayMs;
    let count = 0;
    postsSnap.forEach((d) => {
      const data = d.data();
      if (data.createdAt?.toDate) { const t = data.createdAt.toDate().getTime(); if (t <= dayStart && t > dayEnd) count++; }
    });
    postsPerDay.push({ date: new Date(dayStart).toLocaleDateString("en", { weekday: "short" }), count });
  }

  const popularPosts = postsSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as DocumentData) }))
    .sort((a: any, b: any) => (b.likes || 0) - (a.likes || 0))
    .slice(0, 5);

  let totalLikes = 0, totalComments = 0, totalShares = 0;
  postsSnap.forEach((d) => {
    const data = d.data();
    totalLikes += data.likes || 0;
    totalComments += data.comments || 0;
    totalShares += data.shares || 0;
  });

  return { dau, registrations, postsPerDay, popularPosts, totalLikes, totalComments, totalShares, totalUsers: usersSnap.size, totalPosts: postsSnap.size };
}

export async function sendBroadcastNotification(data: { title: string; body: string; adminId: string; adminName: string }) {
  const ref = doc(collection(db, "broadcasts"));
  await setDoc(ref, { ...data, createdAt: serverTimestamp(), read: false });
  const usersSnap = await getDocs(collection(db, "users"));
  for (const userDoc of usersSnap.docs) {
    const notifRef = doc(collection(db, "notifications"));
    await setDoc(notifRef, {
      recipientId: userDoc.id,
      actorId: data.adminId,
      actorUsername: "Hivez",
      actorDisplayName: data.adminName,
      actorPhotoURL: "",
      type: "broadcast",
      text: data.body,
      link: "/",
      read: false,
      createdAt: serverTimestamp(),
    });
  }
}

export async function getBroadcasts() {
  const snap = await getDocs(query(collection(db, "broadcasts"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as DocumentData) }));
}

export async function getMediaStats() {
  const postsSnap = await getDocs(collection(db, "posts"));
  let totalMedia = 0, videoCount = 0, imageCount = 0;
  postsSnap.forEach((d) => {
    const data = d.data();
    if (data.mediaItems?.length) {
      totalMedia += data.mediaItems.length;
      data.mediaItems.forEach((item: any) => { if (item.type === "video") videoCount++; else imageCount++; });
    } else if (data.mediaUrls?.length) {
      totalMedia += data.mediaUrls.length;
      data.mediaUrls.forEach(() => { if (data.mediaType === "video") videoCount++; else imageCount++; });
    } else if (data.mediaUrl) {
      totalMedia++;
      if (data.mediaType === "video") videoCount++; else imageCount++;
    }
  });
  return { totalMedia, videoCount, imageCount, totalPosts: postsSnap.size };
}

export async function getAdmins() {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs
    .map((d) => ({ uid: d.id, ...(d.data() as DocumentData) }))
    .filter((u: any) => u.role === "admin" || u.role === "moderator" || u.isAdmin === true);
}

export async function getSettings(): Promise<AdminSettings> {
  const snap = await getDoc(doc(db, "settings", "app"));
  if (snap.exists()) return snap.data() as AdminSettings;
  return { siteName: "Hivez", siteLogo: "", maintenanceMode: false, signupEnabled: true, emailNotifications: true, aiModeration: false, autoTagging: false, spamDetection: true, maxPostSize: 10, allowVideo: true };
}

export async function saveSettings(settings: AdminSettings) {
  await setDoc(doc(db, "settings", "app"), settings, { merge: true });
}

export async function getLogs(constraints: QueryConstraint[] = []) {
  const q = query(collection(db, "admin_logs"), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as DocumentData) }));
}

export function subscribeToUsers(callback: (users: AdminUser[]) => void) {
  const q = query(collection(db, "users"), orderBy("createdAt", "desc"), limit(100));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as DocumentData) })) as AdminUser[]);
  });
}

export function subscribeToPosts(callback: (posts: AdminPost[]) => void) {
  const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(100));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as DocumentData) })) as AdminPost[]);
  });
}

export function subscribeToReports(callback: (reports: AdminReport[]) => void) {
  const q = query(collection(db, "reports"), orderBy("createdAt", "desc"), limit(100));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as DocumentData) })) as AdminReport[]);
  });
}