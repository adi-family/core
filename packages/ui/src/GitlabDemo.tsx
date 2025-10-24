import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";

export function GitlabDemo() {
  return (
    <section id="gitlab" className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">GitLab Components</h2>
        <p className="text-gray-600">Specialized components for GitLab integration</p>
      </div>

      <Card>
        <CardHeader className="bg-gradient-to-r from-orange-600 to-red-500 text-white">
          <CardTitle>GitLab Integration Components</CardTitle>
          <CardDescription className="text-orange-100">
            Components for GitLab secrets and repository selection
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Available Components
            </h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-orange-600">•</span>
                <div>
                  <strong>GitlabSecretAutocomplete</strong> - Autocomplete for selecting GitLab API tokens with validation
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-600">•</span>
                <div>
                  <strong>GitlabRepositorySelect</strong> - Search and select from GitLab repositories
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-600">•</span>
                <div>
                  <strong>ProjectSelect</strong> - Select from available projects with search
                </div>
              </li>
            </ul>
          </div>

          <div className="bg-blue-50 border border-blue-200 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-blue-600 text-lg">ℹ️</span>
              <h4 className="font-semibold text-blue-900">Integration Required</h4>
            </div>
            <p className="text-sm text-blue-800">
              These components require API client integration to function. They accept a <code className="bg-blue-100 px-1 py-0.5">client</code> prop
              that provides access to your backend API.
            </p>
            <p className="text-sm text-blue-800">
              See the client implementation for usage examples with authentication.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Features
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 border border-gray-200">
                <div className="font-medium text-sm mb-1">Token Validation</div>
                <p className="text-xs text-gray-600">Validates GitLab tokens and checks required scopes</p>
              </div>
              <div className="p-3 bg-gray-50 border border-gray-200">
                <div className="font-medium text-sm mb-1">Repository Search</div>
                <p className="text-xs text-gray-600">Search through GitLab repositories with autocomplete</p>
              </div>
              <div className="p-3 bg-gray-50 border border-gray-200">
                <div className="font-medium text-sm mb-1">Secret Management</div>
                <p className="text-xs text-gray-600">Create and select encrypted secrets for GitLab access</p>
              </div>
              <div className="p-3 bg-gray-50 border border-gray-200">
                <div className="font-medium text-sm mb-1">Project Integration</div>
                <p className="text-xs text-gray-600">Associate GitLab resources with projects</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
