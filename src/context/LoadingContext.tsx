import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

import HivezLoader from "@/components/common/HivezLoader";

type LoadingTask = {
  id: string;
  progress: number;
  blocking: boolean;
};

type LoadingContextType = {
  beginLoading: (id: string, options?: { progress?: number; blocking?: boolean }) => void;
  updateLoading: (id: string, progress: number) => void;
  endLoading: (id: string) => void;
  progress: number;
  isLoading: boolean;
};

const LoadingContext = createContext<LoadingContextType | null>(null);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Record<string, LoadingTask>>({});

  const beginLoading = useCallback<LoadingContextType["beginLoading"]>((id, options) => {
    setTasks((current) => ({
      ...current,
      [id]: {
        id,
        progress: options?.progress ?? 0,
        blocking: options?.blocking ?? false,
      },
    }));
  }, []);

  const updateLoading = useCallback((id: string, progress: number) => {
    setTasks((current) => {
      const task = current[id];
      if (!task) return current;
      return {
        ...current,
        [id]: {
          ...task,
          progress,
        },
      };
    });
  }, []);

  const endLoading = useCallback((id: string) => {
    setTasks((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }, []);

  const taskList = Object.values(tasks);
  const isLoading = taskList.length > 0;
  const blockingTasks = taskList.filter((task) => task.blocking);
  const progress = taskList.length
    ? taskList.reduce((total, task) => total + Math.min(100, Math.max(0, task.progress)), 0) / taskList.length
    : 100;

  const value = useMemo(
    () => ({ beginLoading, updateLoading, endLoading, progress, isLoading }),
    [beginLoading, updateLoading, endLoading, progress, isLoading]
  );

  return (
    <LoadingContext.Provider value={value}>
      {children}
      {blockingTasks.length > 0 && <HivezLoader fullScreen size="lg" progress={progress} label="Loading Hivez" />}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error("useLoading must be used inside LoadingProvider");
  }
  return context;
}
