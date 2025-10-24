import React from "react";
import { Label } from "./label";
import { Input } from "./input";

export function LabelDemo() {
  return (
    <section id="labels" className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Labels</h2>
        <p className="text-gray-600">Form label components with uppercase tracking</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Basic Label */}
        <div className="space-y-2">
          <Label htmlFor="basic-label">Basic Label</Label>
          <Input id="basic-label" type="text" placeholder="Associated input" />
          <p className="text-xs text-gray-500">Standard label with uppercase tracking</p>
        </div>

        {/* Required Label */}
        <div className="space-y-2">
          <Label htmlFor="required-label">
            Required Field <span className="text-red-500">*</span>
          </Label>
          <Input id="required-label" type="text" required placeholder="Required input" />
          <p className="text-xs text-gray-500">Label indicating required field</p>
        </div>

        {/* Custom Colored Label */}
        <div className="space-y-2">
          <Label htmlFor="colored-label" className="text-blue-600">
            Custom Color
          </Label>
          <Input id="colored-label" type="text" placeholder="With colored label" />
          <p className="text-xs text-gray-500">Label with custom text color</p>
        </div>

        {/* Label with Description */}
        <div className="space-y-2">
          <Label htmlFor="description-label">
            API Token
          </Label>
          <Input id="description-label" type="password" placeholder="Enter your API token" />
          <p className="text-xs text-gray-500">Label with helpful description below</p>
        </div>

        {/* Large Label */}
        <div className="space-y-2">
          <Label htmlFor="large-label" className="text-base">
            Larger Label
          </Label>
          <Input id="large-label" type="text" placeholder="With larger text" />
          <p className="text-xs text-gray-500">Label with increased font size</p>
        </div>

        {/* Label Group */}
        <div className="space-y-4">
          <div>
            <Label className="text-lg font-bold">Section Title</Label>
            <p className="text-sm text-gray-600 mt-1">Group of related fields</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="field1">Field One</Label>
            <Input id="field1" type="text" placeholder="First field" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="field2">Field Two</Label>
            <Input id="field2" type="text" placeholder="Second field" />
          </div>
        </div>
      </div>
    </section>
  );
}
