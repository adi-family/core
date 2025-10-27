/**
 * ProjectContext - Global project selection state management
 *
 * Provides project selection functionality across the application.
 * Selected project is persisted to localStorage and used to filter
 * tasks, sources, and other project-specific data.
 */
import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ProjectContextType {
  selectedProjectId: string | null;
  setSelectedProjectId: (projectId: string | null) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

const STORAGE_KEY = 'adi_selected_project_id';

interface ProjectProviderProps {
  children: ReactNode;
}

/**
 * ProjectProvider - Wraps the app to provide project selection state
 *
 * Automatically loads the last selected project from localStorage on mount.
 * Updates localStorage whenever the selection changes.
 */
export function ProjectProvider({ children }: ProjectProviderProps) {
  const [selectedProjectId, setSelectedProjectIdState] = useState<string | null>(() => {
    // Initialize from localStorage
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored || null;
  });

  const setSelectedProjectId = (projectId: string | null) => {
    setSelectedProjectIdState(projectId);
    if (projectId) {
      localStorage.setItem(STORAGE_KEY, projectId);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <ProjectContext.Provider value={{ selectedProjectId, setSelectedProjectId }}>
      {children}
    </ProjectContext.Provider>
  );
}

/**
 * useProject - Hook to access project selection state
 *
 * @returns {ProjectContextType} Current selected project and setter
 * @throws {Error} If used outside ProjectProvider
 */
export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}
