import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card";

export function CardDemo() {
  return (
    <section id="cards" className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Cards</h2>
        <p className="text-gray-600">Card components with header, content, and footer sections</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Basic Card */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Card</CardTitle>
            <CardDescription>Simple card with header and content</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700">
              This is a basic card component with header, description, and content areas.
            </p>
          </CardContent>
        </Card>

        {/* Card with Footer */}
        <Card>
          <CardHeader>
            <CardTitle>Card with Footer</CardTitle>
            <CardDescription>Card featuring a footer section</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700">
              This card includes a footer section for actions or additional information.
            </p>
          </CardContent>
          <CardFooter className="gap-2">
            <button className="px-4 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors">
              Action
            </button>
            <button className="px-4 py-2 bg-gray-200 text-gray-800 text-sm rounded hover:bg-gray-300 transition-colors">
              Cancel
            </button>
          </CardFooter>
        </Card>

        {/* Gradient Header Card */}
        <Card>
          <CardHeader className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white">
            <CardTitle>Gradient Header</CardTitle>
            <CardDescription className="text-blue-100">With colored background</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-700">
              Cards can have customized headers with gradient backgrounds and custom styling.
            </p>
          </CardContent>
        </Card>

        {/* Full Content Card */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="font-bold text-lg">Content Only</h3>
            <p className="text-sm text-gray-700">
              Cards don't require headers - you can use just the content section for simpler layouts.
            </p>
            <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
              <li>Flexible layout options</li>
              <li>Customizable styling</li>
              <li>Responsive design</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
