import { useState } from "react";
import { Select } from "./select";
import { Label } from "./label";

export function SelectDemo() {
  const [country, setCountry] = useState("");
  const [priority, setPriority] = useState("medium");
  const [status, setStatus] = useState("");

  return (
    <section id="selects" className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Selects</h2>
        <p className="text-gray-600">Dropdown selection components</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Basic Select */}
        <div className="space-y-2">
          <Label htmlFor="country-select">Country</Label>
          <Select
            id="country-select"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          >
            <option value="">Select a country...</option>
            <option value="us">United States</option>
            <option value="uk">United Kingdom</option>
            <option value="ca">Canada</option>
            <option value="au">Australia</option>
            <option value="de">Germany</option>
            <option value="fr">France</option>
          </Select>
          <p className="text-xs text-gray-500">Basic dropdown selection</p>
        </div>

        {/* Select with Default Value */}
        <div className="space-y-2">
          <Label htmlFor="priority-select">Priority Level</Label>
          <Select
            id="priority-select"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="low">Low Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="high">High Priority</option>
            <option value="critical">Critical Priority</option>
          </Select>
          <p className="text-xs text-gray-500">Select with default value</p>
        </div>

        {/* Grouped Options */}
        <div className="space-y-2">
          <Label htmlFor="status-select">Task Status</Label>
          <Select
            id="status-select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Select status...</option>
            <optgroup label="Active">
              <option value="todo">To Do</option>
              <option value="in-progress">In Progress</option>
              <option value="review">In Review</option>
            </optgroup>
            <optgroup label="Completed">
              <option value="done">Done</option>
              <option value="archived">Archived</option>
            </optgroup>
          </Select>
          <p className="text-xs text-gray-500">Select with option groups</p>
        </div>

        {/* Disabled Select */}
        <div className="space-y-2">
          <Label htmlFor="disabled-select">Disabled Select</Label>
          <Select id="disabled-select" disabled>
            <option>Option 1</option>
            <option>Option 2</option>
          </Select>
          <p className="text-xs text-gray-500">Select in disabled state</p>
        </div>

        {/* Required Select */}
        <div className="space-y-2">
          <Label htmlFor="required-select">
            Required Field <span className="text-red-500">*</span>
          </Label>
          <Select id="required-select" required>
            <option value="">Please select...</option>
            <option value="1">Option 1</option>
            <option value="2">Option 2</option>
            <option value="3">Option 3</option>
          </Select>
          <p className="text-xs text-gray-500">Select marked as required</p>
        </div>

        {/* Custom Styled Select */}
        <div className="space-y-2">
          <Label htmlFor="custom-select">Custom Styled</Label>
          <Select
            id="custom-select"
            className="border-purple-300 focus-visible:ring-purple-500 focus-visible:border-purple-500"
          >
            <option value="">Select...</option>
            <option value="1">Custom Option 1</option>
            <option value="2">Custom Option 2</option>
          </Select>
          <p className="text-xs text-gray-500">Select with custom styling</p>
        </div>
      </div>
    </section>
  );
}
