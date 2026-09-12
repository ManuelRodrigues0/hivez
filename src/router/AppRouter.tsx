import { Navigate, Routes, Route } from "react-router-dom";
import MainLayout from "../components/layout/MainLayout";
import MobileLayout from "../components/layout/MobileLayout";
import HivezLoader from "@/components/common/HivezLoader";

import Home from "@/pages/Home/Home";
import Community from "@/pages/Community/Community";
import Profile from "@/pages/Profile/Profile";
import Activity from "@/pages/Activity/Activity";
import Search from "@/pages/Search/Search";
import Notifications from "@/pages/Notifications/Notifications";
import MapPage from "@/pages/Map/Map";
import Settings from "@/pages/Settings/Settings";
import SettingsLayout from "@/pages/Settings/SettingsLayout";
import AccountSettings from "@/pages/Settings/AccountSettings";
import PrivacySettings from "@/pages/Settings/PrivacySettings";
import SecuritySettings from "@/pages/Settings/SecuritySettings";
import NotificationsSettings from "@/pages/Settings/NotificationsSettings";
import ContentPreferencesSettings from "@/pages/Settings/ContentPreferencesSettings";
import AppearanceSettings from "@/pages/Settings/AppearanceSettings";
import AccessibilitySettings from "@/pages/Settings/AccessibilitySettings";
import LanguageSettings from "@/pages/Settings/LanguageSettings";
import DataSettings from "@/pages/Settings/DataSettings";
import DeleteAccountSettings from "@/pages/Settings/DeleteAccountSettings";
import Volunteering from "@/pages/Volunteering/Volunteering";
import IssueCommunityPage from "@/pages/Volunteering/IssueCommunity";
import CommunityDetails from "@/pages/Volunteering/CommunityDetails";
import MyVolunteering from "@/pages/Volunteering/MyVolunteering";
import VolunteerGroupPage from "@/pages/Volunteering/VolunteerGroup";
import Chats from "@/pages/Chats/Chats";
import SavedPosts from "@/pages/SavedPosts/SavedPosts";

import Camera from "@/pages/Camera/Camera";
import Create from "@/pages/Create/Create";
import PostPage from "@/pages/Post/Post";
import EditProfile from "@/components/profile/EditProfile";

import Login from "@/pages/Login/Login";
import Signup from "@/pages/Signup/Signup";
import CompleteProfile from "@/pages/Signup/CompleteProfile";
import AdminSetup from "@/pages/AdminSetup";
import Landing from "@/pages/Landing/Landing";
import NotFound from "@/pages/NotFound/NotFound";

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
    return <HivezLoader fullScreen size="lg" progress={42} label="Loading Hivez" />;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/post/:id" element={<PostPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/admin-setup" element={<AdminSetup />} />
        <Route path="/" element={<Landing />} />
        <Route path="*" element={<NotFound />} />
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
        <Route path="/my-volunteering" element={<MyVolunteering />} />
        <Route path="/volunteer-group/:groupId" element={<VolunteerGroupPage />} />
        <Route path="/issue-community/:communityId" element={<IssueCommunityPage />} />
        <Route path="/issue-community/:communityId/details" element={<CommunityDetails />} />
        <Route path="/chats" element={<Chats />} />
        <Route path="/saved" element={<SavedPosts />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/settings" element={<SettingsLayout />}>
            <Route index element={<Settings />} />
            <Route path="account" element={<AccountSettings />} />
            <Route path="privacy" element={<PrivacySettings />} />
            <Route path="security" element={<SecuritySettings />} />
            <Route path="notifications" element={<NotificationsSettings />} />
            <Route path="content" element={<ContentPreferencesSettings />} />
            <Route path="appearance" element={<AppearanceSettings />} />
            <Route path="accessibility" element={<AccessibilitySettings />} />
            <Route path="language" element={<LanguageSettings />} />
            <Route path="data" element={<DataSettings />} />
            <Route path="saved" element={<Navigate to="/saved" replace />} />
            <Route path="activity" element={<Navigate to="/activity" replace />} />
            <Route path="delete" element={<DeleteAccountSettings />} />
          </Route>
        <Route path="/profile/edit" element={<EditProfile />} />
      </Route>

      <Route path="/camera" element={<Camera />} />
      <Route path="/create" element={<Create />} />

      <Route element={<MobileLayout />}></Route>

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
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
