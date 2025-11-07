import { useState } from "react";
import { Combobox } from "./combobox";
import { Label } from "./label";

export function ComboboxDemo() {
  const [selectedFramework, setSelectedFramework] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");

  const frameworks = [
    { value: "react", label: "React" },
    { value: "vue", label: "Vue.js" },
    { value: "angular", label: "Angular" },
    { value: "svelte", label: "Svelte" },
    { value: "nextjs", label: "Next.js" },
    { value: "nuxt", label: "Nuxt.js" },
  ];

  const languages = [
    { value: "javascript", label: "JavaScript" },
    { value: "typescript", label: "TypeScript" },
    { value: "python", label: "Python" },
    { value: "java", label: "Java" },
    { value: "csharp", label: "C#" },
    { value: "go", label: "Go" },
    { value: "rust", label: "Rust" },
    { value: "ruby", label: "Ruby" },
  ];

  const countries = [
    { value: "us", label: "United States" },
    { value: "uk", label: "United Kingdom" },
    { value: "ca", label: "Canada" },
    { value: "au", label: "Australia" },
    { value: "de", label: "Germany" },
    { value: "fr", label: "France" },
    { value: "es", label: "Spain" },
    { value: "it", label: "Italy" },
    { value: "jp", label: "Japan" },
    { value: "kr", label: "South Korea" },
  ];

  return (
    <section id="comboboxes" className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Comboboxes</h2>
        <p className="text-gray-600">Searchable dropdown components with autocomplete</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Framework Selector */}
        <div className="space-y-2">
          <Label htmlFor="framework-combobox">Select Framework</Label>
          <Combobox
            id="framework-combobox"
            options={frameworks}
            value={selectedFramework}
            onChange={setSelectedFramework}
            placeholder="Search frameworks..."
          />
          <p className="text-xs text-gray-500">
            Selected: {frameworks.find((f) => f.value === selectedFramework)?.label || "None"}
          </p>
        </div>

        {/* Language Selector */}
        <div className="space-y-2">
          <Label htmlFor="language-combobox">Programming Language</Label>
          <Combobox
            id="language-combobox"
            options={languages}
            value={selectedLanguage}
            onChange={setSelectedLanguage}
            placeholder="Search languages..."
          />
          <p className="text-xs text-gray-500">
            Selected: {languages.find((l) => l.value === selectedLanguage)?.label || "None"}
          </p>
        </div>

        {/* Country Selector */}
        <div className="space-y-2">
          <Label htmlFor="country-combobox">Country</Label>
          <Combobox
            id="country-combobox"
            options={countries}
            value={selectedCountry}
            onChange={setSelectedCountry}
            placeholder="Search countries..."
          />
          <p className="text-xs text-gray-500">
            Selected: {countries.find((c) => c.value === selectedCountry)?.label || "None"}
          </p>
        </div>

        {/* Required Combobox */}
        <div className="space-y-2">
          <Label htmlFor="required-combobox">
            Required Selection <span className="text-red-500">*</span>
          </Label>
          <Combobox
            id="required-combobox"
            options={frameworks}
            value=""
            onChange={() => {}}
            placeholder="This field is required"
            required
          />
          <p className="text-xs text-gray-500">Combobox marked as required</p>
        </div>

        {/* Custom Empty Message */}
        <div className="space-y-2">
          <Label htmlFor="custom-empty-combobox">Custom Empty Message</Label>
          <Combobox
            id="custom-empty-combobox"
            options={[
              { value: "1", label: "Option 1" },
              { value: "2", label: "Option 2" },
            ]}
            value=""
            onChange={() => {}}
            placeholder="Search..."
            emptyMessage="No items match your search"
          />
          <p className="text-xs text-gray-500">Try searching for "test"</p>
        </div>

        {/* Custom Styled Combobox */}
        <div className="space-y-2">
          <Label htmlFor="custom-combobox">Custom Styled</Label>
          <Combobox
            id="custom-combobox"
            options={frameworks}
            value=""
            onChange={() => {}}
            placeholder="Custom border color"
            className="border-purple-300 focus-visible:ring-purple-500 focus-visible:border-purple-500"
          />
          <p className="text-xs text-gray-500">Combobox with custom styling</p>
        </div>
      </div>
    </section>
  );
}
