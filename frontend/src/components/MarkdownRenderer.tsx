"use client";

import ReactMarkdown from "react-markdown";

export default function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        h1: ({ children }) => (
          <h1 className="text-base font-bold c-text mb-2 mt-3 first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-sm font-bold c-text mb-1.5 mt-3 first:mt-0">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-semibold c-text mb-1 mt-2 first:mt-0">{children}</h3>
        ),
        p: ({ children }) => (
          <p className="text-sm c-text-2 leading-relaxed mb-2 last:mb-0">{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold c-text">{children}</strong>
        ),
        ul: ({ children }) => (
          <ul className="list-disc list-outside pl-4 mb-2 space-y-1">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-outside pl-4 mb-2 space-y-1">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="text-sm c-text-2 leading-relaxed">{children}</li>
        ),
        code: ({ children }) => (
          <code className="text-xs font-mono px-1 py-0.5 rounded c-bg-dark c-text">{children}</code>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 pl-3 my-2 c-text-3" style={{ borderColor: "var(--accent)" }}>
            {children}
          </blockquote>
        ),
        hr: () => <hr className="my-3 c-border" />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
