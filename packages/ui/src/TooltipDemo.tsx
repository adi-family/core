import React from "react";
import { Tooltip } from "./tooltip";
import { Badge } from "./badge";

export function TooltipDemo() {
  return (
    <section id="tooltips" className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Tooltips</h2>
        <p className="text-gray-600">Hover tooltips for additional information</p>
      </div>

      <div className="space-y-6">
        {/* Basic Tooltips */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Basic Tooltips</h3>
          <div className="flex flex-wrap gap-4">
            <Tooltip content="This is a basic tooltip">
              <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">
                Hover me
              </button>
            </Tooltip>

            <Tooltip content="Information tooltip with helpful text">
              <button className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors">
                Info Button
              </button>
            </Tooltip>

            <Tooltip content="Delete this item permanently">
              <button className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors">
                Delete
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Tooltips on Text */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Text Tooltips</h3>
          <div className="space-y-2">
            <p className="text-sm text-gray-700">
              This is a paragraph with{" "}
              <Tooltip content="Additional information about this term">
                <span className="font-semibold text-blue-600 cursor-help underline decoration-dotted">
                  tooltips on specific words
                </span>
              </Tooltip>
              {" "}that provide more context.
            </p>
            <p className="text-sm text-gray-700">
              Hover over{" "}
              <Tooltip content="This is an important acronym">
                <abbr className="cursor-help">API</abbr>
              </Tooltip>
              {" "}to see the full meaning.
            </p>
          </div>
        </div>

        {/* Tooltips on Badges */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Tooltips on Badges</h3>
          <div className="flex flex-wrap gap-2">
            <Tooltip content="This task is currently active and in progress">
              <span>
                <Badge variant="success">Active</Badge>
              </span>
            </Tooltip>

            <Tooltip content="Waiting for approval before proceeding">
              <span>
                <Badge variant="warning">Pending</Badge>
              </span>
            </Tooltip>

            <Tooltip content="This task has failed and needs attention">
              <span>
                <Badge variant="danger">Failed</Badge>
              </span>
            </Tooltip>

            <Tooltip content="Currently being processed by the system">
              <span>
                <Badge variant="blue">Processing</Badge>
              </span>
            </Tooltip>
          </div>
        </div>

      </div>
    </section>
  );
}
