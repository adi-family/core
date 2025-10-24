import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { ButtonDemo } from "./src/ButtonDemo";
import "../client/src/assets/output.css";

// Define sections for easy extensibility
const SECTIONS = [
  { id: "buttons", label: "Buttons" },
];

function Demo() {
  const [activeSection, setActiveSection] = useState("buttons");

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSection(sectionId);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-start">
      {/* Sidebar */}
      <aside className="sticky top-0 max-h-screen bg-white p-4 flex-shrink">
        <div className="space-y-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">@adi-simple/ui</h1>
            <p className="text-sm text-gray-600 mt-1">Components Library</p>
          </div>

          <nav className="space-y-1">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeSection === section.id
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {section.label}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main content */}
      <main className="p-8 grow">
        <div className="max-w-5xl mx-auto space-y-8 p-6">
          <ButtonDemo />
        </div>
      </main>
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<Demo />);
