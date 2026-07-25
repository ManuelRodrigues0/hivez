import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

import type { ReactNode } from "react";

import { onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import { auth, db } from "../firebase/firebase";

type AuthContextType = {
  user: User | null;
  loading: boolean;
  profileCompleted: boolean;
  refreshProfileStatus: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  profileCompleted: false,
  refreshProfileStatus: async () => {},
});

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);

  const [loading, setLoading] = useState(true);

  const [profileCompleted, setProfileCompleted] =
    useState(false);

  const refreshProfileStatus = useCallback(async () => {
    if (!user) {
      setProfileCompleted(false);
      return;
    }

    const snap = await getDoc(
      doc(db, "users", user.uid)
    );

    if (snap.exists()) {
      const data = snap.data();

      setProfileCompleted(
        Boolean(data.profileCompleted)
      );
    } else {
      setProfileCompleted(false);
    }
  }, [user]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        setUser(firebaseUser);

        if (firebaseUser) {
          const snap = await getDoc(
            doc(db, "users", firebaseUser.uid)
          );

          if (snap.exists()) {
            const data = snap.data();

            setProfileCompleted(
              Boolean(data.profileCompleted)
            );
          } else {
            setProfileCompleted(false);
          }
        } else {
          setProfileCompleted(false);
        }

        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        profileCompleted,
        refreshProfileStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
