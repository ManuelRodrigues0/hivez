import { Routes, Route, Navigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

import MobileLayout from "../components/layout/MobileLayout";

import Home from "../pages/Home/Home";
import Login from "../pages/Login/Login";
import Signup from "../pages/Signup/Signup";
import CompleteProfile from "../pages/Signup/CompleteProfile";
import Profile from "../pages/Profile/Profile";
import EditProfile from "../components/profile/EditProfile";
import Create from "../pages/Create/Create";

export default function AppRouter() {
  const { user, loading, profileCompleted } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        Loading...
      </div>
    );
  }

  return (
    <Routes>
      {!user ? (
        <>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </>
      ) : !profileCompleted ? (
        <>
          <Route
            path="/complete-profile"
            element={<CompleteProfile />}
          />

          <Route
            path="*"
            element={<Navigate to="/complete-profile" replace />}
          />
        </>
      ) : (
        <Route element={<MobileLayout />}>
          <Route path="/" element={<Home />} />

          <Route path="/profile" element={<Profile />} />

          <Route
            path="/profile/edit"
            element={<EditProfile />}
          />

          <Route
            path="/create"
            element={<Create />}
          />

          <Route
            path="/search"
            element={<div>Search</div>}
          />

          <Route
            path="/activity"
            element={<div>Activity</div>}
          />

          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />
        </Route>
      )}
    </Routes>
  );
}