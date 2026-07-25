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

import Camera from "@/pages/Camera/Camera";
import Create from "@/pages/Create/Create";
import EditProfile from "@/components/profile/EditProfile";

import Login from "@/pages/Login/Login";
import Signup from "@/pages/Signup/Signup";
import CompleteProfile from "@/pages/Signup/CompleteProfile";

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
        <Route element={<MobileLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (!profileCompleted) {
    return (
      <Routes>
        <Route
          path="*"
          element={<CompleteProfile />}
        />
      </Routes>
    );
  }

  return (
    <Routes>

      {/* Main Application */}

      <Route element={<MainLayout />}>

        <Route index element={<Home />} />

        <Route
          path="/hive/:id"
          element={<Community />}
        />

        <Route
          path="/profile"
          element={<Profile />}
        />

        <Route
          path="/activity"
          element={<Activity />}
        />

        <Route
          path="/search"
          element={<Search />}
        />

        <Route
          path="/notifications"
          element={<Notifications />}
        />

        <Route
          path="/settings"
          element={<Settings />}
        />

        <Route
          path="/profile/edit"
          element={<EditProfile />}
        />

      </Route>

      {/* Standalone Pages */}

      <Route element={<MobileLayout />}>

        <Route
          path="/camera"
          element={<Camera />}
        />

        <Route
          path="/create"
          element={<Create />}
        />

      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />

    </Routes>
  );
}