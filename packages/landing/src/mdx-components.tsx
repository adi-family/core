import type { MDXComponents } from 'mdx/types';

/**
 * Custom MDX components for styling markdown content
 * This function provides custom React components for MDX elements
 */
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: ({ children }) => (
      <h2 className="text-3xl md:text-4xl font-bold mt-10 mb-5 text-white/90 first:mt-0">
        {children}
      </h2>
    ),
    h2: ({ children }) => (
      <h3 className="text-2xl md:text-3xl font-bold mt-8 mb-4 text-white/85">
        {children}
      </h3>
    ),
    h3: ({ children }) => (
      <h4 className="text-xl md:text-2xl font-semibold mt-6 mb-3 text-white/80">
        {children}
      </h4>
    ),
    h4: ({ children }) => (
      <h5 className="text-lg md:text-xl font-semibold mt-5 mb-2 text-white/75">
        {children}
      </h5>
    ),
    p: ({ children }) => (
      <p className="my-5 text-white/70 leading-relaxed text-base md:text-lg">
        {children}
      </p>
    ),
    a: ({ href, children }) => (
      <a
        href={href}
        className="text-blue-400 hover:text-blue-300 underline decoration-blue-400/30 hover:decoration-blue-300 transition-colors"
        target={href?.startsWith('http') ? '_blank' : undefined}
        rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
      >
        {children}
      </a>
    ),
    ul: ({ children }) => (
      <ul className="my-6 ml-6 list-disc space-y-2 text-white/70 marker:text-blue-400">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="my-6 ml-6 list-decimal space-y-2 text-white/70 marker:text-purple-400">
        {children}
      </ol>
    ),
    li: ({ children }) => <li className="leading-relaxed pl-2">{children}</li>,
    code: ({ children }) => (
      <code className="bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded text-sm font-mono text-blue-300">
        {children}
      </code>
    ),
    pre: ({ children }) => (
      <pre className="bg-slate-950/80 border border-white/10 p-5 rounded-xl overflow-x-auto my-6 backdrop-blur-sm">
        {children}
      </pre>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-purple-500/50 bg-purple-500/5 pl-6 pr-4 py-4 my-6 rounded-r-lg">
        <div className="text-white/60 italic">{children}</div>
      </blockquote>
    ),
    hr: () => (
      <hr className="my-8 border-t border-white/10" />
    ),
    table: ({ children }) => (
      <div className="my-6 overflow-x-auto">
        <table className="w-full border-collapse">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-slate-900/50 border-b border-white/10">
        {children}
      </thead>
    ),
    tbody: ({ children }) => (
      <tbody className="divide-y divide-white/10">
        {children}
      </tbody>
    ),
    tr: ({ children }) => (
      <tr className="hover:bg-slate-900/30 transition-colors">
        {children}
      </tr>
    ),
    th: ({ children }) => (
      <th className="px-4 py-3 text-left text-sm font-semibold text-white/80">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-4 py-3 text-sm text-white/70">
        {children}
      </td>
    ),
    strong: ({ children }) => (
      <strong className="font-bold text-white/90">{children}</strong>
    ),
    em: ({ children }) => (
      <em className="italic text-white/80">{children}</em>
    ),
    ...components,
  };
}
