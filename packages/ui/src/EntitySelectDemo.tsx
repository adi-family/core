import { useState } from "react";
import { ProjectSelect } from "./project-select";
import { TaskSourceSelect } from "./task-source-select";
import { FileSpaceSelect } from "./file-space-select";
import { TaskSelect } from "./task-select";
import { SessionSelect } from "./session-select";
import { WorkerRepositorySelect } from "./worker-repository-select";
import { PipelineExecutionSelect } from "./pipeline-execution-select";
import {
  mockProjectClient,
  mockTaskSourceClient,
  mockFileSpaceClient,
  mockTaskClient,
  mockSessionClient,
  mockWorkerRepositoryClient,
  mockPipelineExecutionClient,
} from "./mock-client";

export function EntitySelectDemo() {
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedTaskSource, setSelectedTaskSource] = useState("");
  const [selectedFileSpace, setSelectedFileSpace] = useState("");
  const [selectedTask, setSelectedTask] = useState("");
  const [selectedSession, setSelectedSession] = useState("");
  const [selectedWorkerRepo, setSelectedWorkerRepo] = useState("");
  const [selectedPipelineExecution, setSelectedPipelineExecution] = useState("");

  return (
    <section id="entity-selects" className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Entity Selects</h2>
        <p className="text-gray-600">
          Autocomplete components for selecting various entities with mock data
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Project Select */}
        <div className="space-y-2">
          <ProjectSelect
            client={mockProjectClient}
            value={selectedProject}
            onChange={setSelectedProject}
          />
          <p className="text-xs text-gray-500">
            Selected Project ID: {selectedProject || "None"}
          </p>
        </div>

        {/* Task Source Select - All */}
        <div className="space-y-2">
          <TaskSourceSelect
            client={mockTaskSourceClient}
            value={selectedTaskSource}
            onChange={setSelectedTaskSource}
          />
          <p className="text-xs text-gray-500">
            Selected Task Source ID: {selectedTaskSource || "None"}
          </p>
        </div>

        {/* Task Source Select - Filtered by Project */}
        <div className="space-y-2">
          <TaskSourceSelect
            client={mockTaskSourceClient}
            value=""
            onChange={() => {}}
            projectId="1"
            label="TASK SOURCE (PROJECT FILTERED)"
            placeholder="Task sources for Web Application..."
          />
          <p className="text-xs text-gray-500">
            Filtered to show only task sources for project "1" (Web Application)
          </p>
        </div>

        {/* File Space Select */}
        <div className="space-y-2">
          <FileSpaceSelect
            client={mockFileSpaceClient}
            value={selectedFileSpace}
            onChange={setSelectedFileSpace}
          />
          <p className="text-xs text-gray-500">
            Selected File Space ID: {selectedFileSpace || "None"}
          </p>
        </div>

        {/* File Space Select - Filtered by Project */}
        <div className="space-y-2">
          <FileSpaceSelect
            client={mockFileSpaceClient}
            value=""
            onChange={() => {}}
            projectId="2"
            label="FILE SPACE (PROJECT FILTERED)"
            placeholder="File spaces for Mobile App..."
          />
          <p className="text-xs text-gray-500">
            Filtered to show only file spaces for project "2" (Mobile App)
          </p>
        </div>

        {/* Task Select */}
        <div className="space-y-2">
          <TaskSelect
            client={mockTaskClient}
            value={selectedTask}
            onChange={setSelectedTask}
          />
          <p className="text-xs text-gray-500">
            Selected Task ID: {selectedTask || "None"} (shows status icons)
          </p>
        </div>

        {/* Task Select - Filtered by Project */}
        <div className="space-y-2">
          <TaskSelect
            client={mockTaskClient}
            value=""
            onChange={() => {}}
            projectId="1"
            label="TASK (PROJECT FILTERED)"
            placeholder="Tasks for Web Application..."
          />
          <p className="text-xs text-gray-500">
            Filtered to show only tasks for project "1"
          </p>
        </div>

        {/* Task Select - Filtered by Task Source */}
        <div className="space-y-2">
          <TaskSelect
            client={mockTaskClient}
            value=""
            onChange={() => {}}
            taskSourceId="ts-1"
            label="TASK (TASK SOURCE FILTERED)"
            placeholder="Tasks from Web App GitLab Issues..."
          />
          <p className="text-xs text-gray-500">
            Filtered to show only tasks from task source "ts-1"
          </p>
        </div>

        {/* Session Select */}
        <div className="space-y-2">
          <SessionSelect
            client={mockSessionClient}
            value={selectedSession}
            onChange={setSelectedSession}
          />
          <p className="text-xs text-gray-500">
            Selected Session ID: {selectedSession || "None"}
          </p>
        </div>

        {/* Session Select - Filtered by Task */}
        <div className="space-y-2">
          <SessionSelect
            client={mockSessionClient}
            value=""
            onChange={() => {}}
            taskId="task-1"
            label="SESSION (TASK FILTERED)"
            placeholder="Sessions for task-1..."
          />
          <p className="text-xs text-gray-500">
            Filtered to show only sessions for task "task-1"
          </p>
        </div>

        {/* Worker Repository Select */}
        <div className="space-y-2">
          <WorkerRepositorySelect
            client={mockWorkerRepositoryClient}
            value={selectedWorkerRepo}
            onChange={setSelectedWorkerRepo}
          />
          <p className="text-xs text-gray-500">
            Selected Worker Repository ID: {selectedWorkerRepo || "None"}
          </p>
        </div>

        {/* Worker Repository Select - Filtered by Project */}
        <div className="space-y-2">
          <WorkerRepositorySelect
            client={mockWorkerRepositoryClient}
            value=""
            onChange={() => {}}
            projectId="1"
            label="WORKER REPOSITORY (PROJECT FILTERED)"
            placeholder="Worker repositories for Web Application..."
          />
          <p className="text-xs text-gray-500">
            Filtered to show only worker repositories for project "1"
          </p>
        </div>

        {/* Pipeline Execution Select */}
        <div className="space-y-2">
          <PipelineExecutionSelect
            client={mockPipelineExecutionClient}
            value={selectedPipelineExecution}
            onChange={setSelectedPipelineExecution}
          />
          <p className="text-xs text-gray-500">
            Selected Pipeline Execution ID: {selectedPipelineExecution || "None"} (shows status icons)
          </p>
        </div>

        {/* Pipeline Execution Select - Filtered by Session */}
        <div className="space-y-2">
          <PipelineExecutionSelect
            client={mockPipelineExecutionClient}
            value=""
            onChange={() => {}}
            sessionId="session-1"
            label="PIPELINE EXECUTION (SESSION FILTERED)"
            placeholder="Executions for session-1..."
          />
          <p className="text-xs text-gray-500">
            Filtered to show only executions for session "session-1"
          </p>
        </div>

        {/* Pipeline Execution Select - Filtered by Worker Repository */}
        <div className="space-y-2">
          <PipelineExecutionSelect
            client={mockPipelineExecutionClient}
            value=""
            onChange={() => {}}
            workerRepositoryId="wr-1"
            label="PIPELINE EXECUTION (WORKER REPO FILTERED)"
            placeholder="Executions for worker repo wr-1..."
          />
          <p className="text-xs text-gray-500">
            Filtered to show only executions for worker repository "wr-1"
          </p>
        </div>

        {/* Required Entity Select */}
        <div className="space-y-2">
          <ProjectSelect
            client={mockProjectClient}
            value=""
            onChange={() => {}}
            required
            label="REQUIRED PROJECT"
            placeholder="This field is required..."
          />
          <p className="text-xs text-gray-500">
            Example of a required entity select
          </p>
        </div>
      </div>

      {/* Cascading Selects Example */}
      <div className="mt-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Cascading Selects Example
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Select a project, then see filtered task sources and file spaces
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <ProjectSelect
            client={mockProjectClient}
            value={selectedProject}
            onChange={setSelectedProject}
            label="1. SELECT PROJECT"
          />
          <TaskSourceSelect
            client={mockTaskSourceClient}
            value={selectedTaskSource}
            onChange={setSelectedTaskSource}
            projectId={selectedProject || undefined}
            label="2. SELECT TASK SOURCE"
            placeholder={
              selectedProject
                ? "Task sources for selected project..."
                : "Select a project first..."
            }
          />
          <FileSpaceSelect
            client={mockFileSpaceClient}
            value={selectedFileSpace}
            onChange={setSelectedFileSpace}
            projectId={selectedProject || undefined}
            label="3. SELECT FILE SPACE"
            placeholder={
              selectedProject
                ? "File spaces for selected project..."
                : "Select a project first..."
            }
          />
        </div>
      </div>
    </section>
  );
}
