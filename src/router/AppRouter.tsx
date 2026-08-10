import { Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "../components/layout/MainLayout";
import MobileLayout from "../components/layout/MobileLayout";

import Home from "@/pages/Home/Home";
import Community from "@/pages/Community/Community";
import Profile from "@/pages/Profile/Profile";
import Activity from "@/pages/Activity/Activity";
import Search from "@/pages/Search/Search";
import Notifications from "@/pages/Notifications/Notifications";
import Settings from "@/pages/Settings/Settings";
import Volunteering from "@/pages/Volunteering/Volunteering";
import Chats from "@/pages/Chats/Chats";

import Camera from "@/pages/Camera/Camera";
import Create from "@/pages/Create/Create";
import PostPage from "@/pages/Post/Post";
import EditProfile from "@/components/profile/EditProfile";

import Login from "@/pages/Login/Login";
import Signup from "@/pages/Signup/Signup";
import CompleteProfile from "@/pages/Signup/CompleteProfile";
import AdminSetup from "@/pages/AdminSetup";
import Landing from "@/pages/Landing/Landing";

import AdminLayout from "../components/admin/AdminLayout";
import {
  AdminDashboard,
  AdminUsers,
  AdminPosts,
  AdminReports,
  AdminIssues,
  AdminHives,
  AdminAIQueue,
  AdminNotifications,
  AdminAnalytics,
  AdminMedia,
  AdminRoles,
  AdminSettings,
  AdminLogs,
} from "../components/admin/AdminPages";
import { useAuth } from "@/context/AuthContext";

export default function AppRouter() {
  const { user, loading, profileCompleted } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/post/:id" element={<PostPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/admin-setup" element={<AdminSetup />} />
        <Route path="/" element={<Landing />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  if (!profileCompleted) {
    return (
      <Routes>
        <Route path="/post/:id" element={<PostPage />} />
        <Route path="/admin-setup" element={<AdminSetup />} />
        <Route path="*" element={<CompleteProfile />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/post/:id" element={<PostPage />} />

      <Route element={<MainLayout />}>
        <Route index element={<Home />} />
        <Route path="/hive/:id" element={<Community />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/activity" element={<Activity />} />
        <Route path="/search" element={<Search />} />
        <Route path="/volunteering" element={<Volunteering />} />
        <Route path="/chats" element={<Chats />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/profile/edit" element={<EditProfile />} />
      </Route>

      <Route element={<MobileLayout />}>
        <Route path="/camera" element={<Camera />} />
        <Route path="/create" element={<Create />} />
      </Route>

      <Route element={<AdminLayout />}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/posts" element={<AdminPosts />} />
        <Route path="/admin/reports" element={<AdminReports />} />
        <Route path="/admin/issues" element={<AdminIssues />} />
        <Route path="/admin/hives" element={<AdminHives />} />
        <Route path="/admin/ai-queue" element={<AdminAIQueue />} />
        <Route path="/admin/notifications" element={<AdminNotifications />} />
        <Route path="/admin/analytics" element={<AdminAnalytics />} />
        <Route path="/admin/media" element={<AdminMedia />} />
        <Route path="/admin/roles" element={<AdminRoles />} />
        <Route path="/admin/settings" element={<AdminSettings />} />
        <Route path="/admin/logs" element={<AdminLogs />} />
      </Route>

      <Route path="/admin-setup" element={<AdminSetup />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}