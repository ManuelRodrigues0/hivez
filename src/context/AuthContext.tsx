import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

import { onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";

import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "../firebase/firebase";

type AuthContextType = {
  user: User | null;
  loading: boolean;
  profileCompleted: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  profileCompleted: false,
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        setUser(firebaseUser);

        if (firebaseUser) {
          const userDoc = await getDoc(
            doc(db, "users", firebaseUser.uid)
          );

          if (userDoc.exists()) {
            const data = userDoc.data();

            setProfileCompleted(
              data.profileCompleted === true
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}