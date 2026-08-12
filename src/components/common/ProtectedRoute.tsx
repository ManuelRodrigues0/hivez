import { Navigate } from "react-router-dom";
import HivezLoader from "./HivezLoader";
import { useAuth } from "../../context/AuthContext";

type Props = {
  children: React.ReactNode;
};

export default function ProtectedRoute({
  children,
}: Props) {
  const { user, loading } = useAuth();

  if (loading) {
    return <HivezLoader fullScreen size="lg" progress={42} label="Loading Hivez" />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
