import { useState } from "react";
import { Button, buttonVariants, buttonSizes } from "./button";
import { Card, CardContent } from "./card";

export function ButtonDemo() {
  const [isDisabled, setIsDisabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showTooltip, setShowTooltip] = useState(true);

  return (
    <section id="buttons" className="space-y-6 scroll-mt-8">
      <h2 className="text-2xl font-semibold text-gray-900">Buttons</h2>
      <Card>
        <CardContent className="pt-6 space-y-6">
          {/* Controls */}
          <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isDisabled}
                onChange={(e) => setIsDisabled(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm font-medium">Disabled</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isLoading}
                onChange={(e) => setIsLoading(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm font-medium">Loading</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showTooltip}
                onChange={(e) => setShowTooltip(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm font-medium">Show Tooltip</span>
            </label>
          </div>

          {/* All Variants */}
          <div className="flex flex-wrap gap-4">
            {buttonVariants.map((variant) => (
              <Button
                key={variant}
                disabled={isDisabled}
                loading={isLoading}
                variant={variant}
                tooltip={showTooltip ? `This is a ${variant} button` : undefined}
              >
                {variant.charAt(0).toUpperCase() + variant.slice(1)}
              </Button>
            ))}
          </div>

          {/* All Sizes */}
          <div className="flex flex-wrap gap-4">
            {buttonSizes.map((size) => (
              <Button
                key={size}
                disabled={isDisabled}
                loading={isLoading}
                size={size}
                tooltip={showTooltip ? `Button size: ${size}` : undefined}
              >
                {size.charAt(0).toUpperCase() + size.slice(1)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
