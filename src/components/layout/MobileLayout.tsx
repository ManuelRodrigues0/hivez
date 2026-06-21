import { Outlet } from "react-router-dom";

export default function MobileLayout() {
  return (
    <div className="min-h-screen bg-black text-white max-w-md mx-auto">
      <Outlet />
    </div>
  );
}