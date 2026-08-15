import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  createLocationSnapshot,
  detectBrowserLocation,
  type LocationSnapshot,
  type UserLocationState,
} from "@/services/location";

type LocationContextValue = UserLocationState & {
  requestLocation: () => Promise<LocationSnapshot | null>;
  setManualLocation: (location: LocationSnapshot) => void;
};

const LocationContext = createContext<LocationContextValue>({
  status: "idle",
  location: null,
  requestLocation: async () => null,
  setManualLocation: () => {},
});

const STORAGE_KEY = "hivez.manual-location";

export function LocationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UserLocationState>({ status: "idle", location: null });

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      setState({ status: "manual", location: createLocationSnapshot(JSON.parse(saved)) });
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const requestLocation = useCallback(async () => {
    setState((current) => ({ ...current, status: "detecting", error: undefined }));
    try {
      const location = await detectBrowserLocation();
      setState({ status: "granted", location });
      return location;
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "unavailable";
      setState((current) => ({
        status: code === "denied" || code === "timeout" || code === "unsupported" ? code : "unavailable",
        location: current.location,
        error: error instanceof Error ? error.message : "Unable to detect location.",
      }));
      return null;
    }
  }, []);

  const setManualLocation = useCallback((location: LocationSnapshot) => {
    const snapshot = createLocationSnapshot(location);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    setState({ status: "manual", location: snapshot });
  }, []);

  const value = useMemo(
    () => ({ ...state, requestLocation, setManualLocation }),
    [requestLocation, setManualLocation, state],
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useUserLocation() {
  return useContext(LocationContext);
}
