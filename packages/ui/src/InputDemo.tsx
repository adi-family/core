import React, { useState } from "react";
import { Input } from "./input";
import { Label } from "./label";

export function InputDemo() {
  const [textValue, setTextValue] = useState("");
  const [emailValue, setEmailValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [numberValue, setNumberValue] = useState("");

  return (
    <section id="inputs" className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Inputs</h2>
        <p className="text-gray-600">Form input components with various types and states</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Text Input */}
        <div className="space-y-2">
          <Label htmlFor="text-input">Text Input</Label>
          <Input
            id="text-input"
            type="text"
            placeholder="Enter text..."
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
          />
          <p className="text-xs text-gray-500">Basic text input field</p>
        </div>

        {/* Email Input */}
        <div className="space-y-2">
          <Label htmlFor="email-input">Email Input</Label>
          <Input
            id="email-input"
            type="email"
            placeholder="email@example.com"
            value={emailValue}
            onChange={(e) => setEmailValue(e.target.value)}
          />
          <p className="text-xs text-gray-500">Email type with validation</p>
        </div>

        {/* Password Input */}
        <div className="space-y-2">
          <Label htmlFor="password-input">Password Input</Label>
          <Input
            id="password-input"
            type="password"
            placeholder="Enter password..."
            value={passwordValue}
            onChange={(e) => setPasswordValue(e.target.value)}
          />
          <p className="text-xs text-gray-500">Password input with hidden characters</p>
        </div>

        {/* Number Input */}
        <div className="space-y-2">
          <Label htmlFor="number-input">Number Input</Label>
          <Input
            id="number-input"
            type="number"
            placeholder="0"
            value={numberValue}
            onChange={(e) => setNumberValue(e.target.value)}
          />
          <p className="text-xs text-gray-500">Numeric input with steppers</p>
        </div>

        {/* Disabled Input */}
        <div className="space-y-2">
          <Label htmlFor="disabled-input">Disabled Input</Label>
          <Input
            id="disabled-input"
            type="text"
            placeholder="Disabled input"
            disabled
          />
          <p className="text-xs text-gray-500">Input in disabled state</p>
        </div>

        {/* Required Input */}
        <div className="space-y-2">
          <Label htmlFor="required-input">Required Input</Label>
          <Input
            id="required-input"
            type="text"
            placeholder="This field is required"
            required
          />
          <p className="text-xs text-gray-500">Input marked as required</p>
        </div>

        {/* File Input */}
        <div className="space-y-2">
          <Label htmlFor="file-input">File Input</Label>
          <Input
            id="file-input"
            type="file"
          />
          <p className="text-xs text-gray-500">File upload input</p>
        </div>

        {/* Input with Custom Styling */}
        <div className="space-y-2">
          <Label htmlFor="custom-input">Custom Styled Input</Label>
          <Input
            id="custom-input"
            type="text"
            placeholder="Custom border color"
            className="border-purple-300 focus-visible:ring-purple-500 focus-visible:border-purple-500"
          />
          <p className="text-xs text-gray-500">Input with custom styling</p>
        </div>
      </div>
    </section>
  );
}
