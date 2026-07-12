import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Project } from './types';
import { createProject, createSampleProject, duplicateProject, makeId } from './model';
import { loadProjects, saveProjects } from './storage';

interface StoreValue {
  loaded: boolean;
  projects: Project[];
  addProject: (name: string) => Project;
  addImportedProject: (project: Project) => void;
  removeProject: (id: string) => void;
  cloneProject: (id: string) => void;
  updateProject: (id: string, updater: (p: Project) => Project) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await loadProjects();
      if (cancelled) return;
      setProjects(stored ?? [createSampleProject()]);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveProjects(projects);
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [projects, loaded]);

  const addProject = useCallback((name: string) => {
    const project = createProject(name.trim() || 'Untitled project');
    setProjects((ps) => [project, ...ps]);
    return project;
  }, []);

  const addImportedProject = useCallback((project: Project) => {
    setProjects((ps) => [project, ...ps]);
  }, []);

  const removeProject = useCallback((id: string) => {
    setProjects((ps) => ps.filter((p) => p.id !== id));
  }, []);

  const cloneProject = useCallback((id: string) => {
    setProjects((ps) => {
      const source = ps.find((p) => p.id === id);
      if (!source) return ps;
      return [duplicateProject(source, `${source.name} copy`), ...ps];
    });
  }, []);

  const updateProject = useCallback((id: string, updater: (p: Project) => Project) => {
    setProjects((ps) =>
      ps.map((p) => (p.id === id ? { ...updater(p), updatedAt: Date.now() } : p))
    );
  }, []);

  const value = useMemo(
    () => ({
      loaded,
      projects,
      addProject,
      addImportedProject,
      removeProject,
      cloneProject,
      updateProject,
    }),
    [loaded, projects, addProject, addImportedProject, removeProject, cloneProject, updateProject]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}

export { makeId };
