import React from "react";
import { Badge } from "./badge";
import { CheckCircle2, AlertCircle, XCircle, Clock, Zap } from "lucide-react";

export function BadgeDemo() {
  return (
    <section id="badges" className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Badges</h2>
        <p className="text-gray-600">Status indicators and labels with various color variants</p>
      </div>

      <div className="space-y-6">
        {/* Variant Colors */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Color Variants</h3>
          <div className="flex flex-wrap gap-2">
            <Badge variant="default">Default</Badge>
            <Badge variant="gray">Gray</Badge>
            <Badge variant="success">Success</Badge>
            <Badge variant="green">Green</Badge>
            <Badge variant="warning">Warning</Badge>
            <Badge variant="danger">Danger</Badge>
            <Badge variant="info">Info</Badge>
            <Badge variant="blue">Blue</Badge>
            <Badge variant="orange">Orange</Badge>
            <Badge variant="purple">Purple</Badge>
          </div>
        </div>

        {/* Badges with Icons */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Badges with Icons</h3>
          <div className="flex flex-wrap gap-2">
            <Badge variant="success" icon={CheckCircle2}>Completed</Badge>
            <Badge variant="warning" icon={AlertCircle}>Pending</Badge>
            <Badge variant="danger" icon={XCircle}>Failed</Badge>
            <Badge variant="blue" icon={Clock}>In Progress</Badge>
            <Badge variant="purple" icon={Zap}>Priority</Badge>
          </div>
        </div>

        {/* Status Examples */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Status Badges</h3>
          <div className="flex flex-wrap gap-2">
            <Badge variant="success">Active</Badge>
            <Badge variant="warning">Pending</Badge>
            <Badge variant="danger">Failed</Badge>
            <Badge variant="blue">Processing</Badge>
            <Badge variant="gray">Inactive</Badge>
          </div>
        </div>

        {/* Priority Badges */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Priority Levels</h3>
          <div className="flex flex-wrap gap-2">
            <Badge variant="danger">Critical</Badge>
            <Badge variant="orange">High</Badge>
            <Badge variant="warning">Medium</Badge>
            <Badge variant="blue">Low</Badge>
          </div>
        </div>

        {/* Environment Badges */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Environments</h3>
          <div className="flex flex-wrap gap-2">
            <Badge variant="danger">Production</Badge>
            <Badge variant="warning">Staging</Badge>
            <Badge variant="blue">Development</Badge>
            <Badge variant="gray">Local</Badge>
          </div>
        </div>

        {/* Custom Styled Badges */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Custom Styling</h3>
          <div className="flex flex-wrap gap-2">
            <Badge variant="purple" className="text-sm px-4 py-2">Large Badge</Badge>
            <Badge variant="green" className="rounded-full">Rounded</Badge>
            <Badge variant="blue" className="font-bold">Bold Text</Badge>
          </div>
        </div>

        {/* Badge Groups */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Badge Groups</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">Task Status:</span>
              <Badge variant="success">Completed</Badge>
              <Badge variant="blue">2 Pending</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">Pipeline:</span>
              <Badge variant="success">Build Passed</Badge>
              <Badge variant="warning">Deploy Pending</Badge>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
