import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

type Props = {
  children: React.ReactNode;
};

export default function ProtectedRoute({
  children,
}: Props) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}