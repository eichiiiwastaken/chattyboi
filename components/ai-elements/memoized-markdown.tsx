"use client";

import type { ComponentProps, HTMLAttributes } from "react";
import type { BundledLanguage } from "shiki";

import { cn } from "@/lib/utils";
import { memo, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockCopyButton,
  CodeBlockFilename,
  CodeBlockHeader,
  CodeBlockTitle,
} from "./code-block";

type MemoizedMarkdownProps = HTMLAttributes<HTMLDivElement> & {
  children: string;
  id: string;
  components?: ComponentProps<typeof ReactMarkdown>["components"];
  remarkPlugins?: ComponentProps<typeof ReactMarkdown>["remarkPlugins"];
  rehypePlugins?: ComponentProps<typeof ReactMarkdown>["rehypePlugins"];
};

export const MemoizedMarkdown = memo(
  ({ children, className, id, ...props }: MemoizedMarkdownProps) => {
    const blocks = useMemo(() => parseMarkdownIntoBlocks(children), [children]);

    return (
      <div className={className}>
        {blocks.map((block, index) => (
          <MemoizedMarkdownBlock
            {...props}
            content={block}
            key={`${id}-block-${index}`}
          />
        ))}
      </div>
    );
  }
);

MemoizedMarkdown.displayName = "MemoizedMarkdown";

type MemoizedMarkdownBlockProps = Omit<MemoizedMarkdownProps, "children" | "id"> & {
  content: string;
};

const MemoizedMarkdownBlock = memo(
  ({ content, ...props }: MemoizedMarkdownBlockProps) => {
    const [showLineNumbers, setShowLineNumbers] = useState(false);

    return (
      <ReactMarkdown
        {...props}
        components={{
          ...props.components,
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className ?? "");
            const codeString = String(children).replace(/\n$/, "");

            if (match) {
              return (
                <CodeBlock
                  code={codeString}
                  language={match[1] as BundledLanguage}
                  showLineNumbers={showLineNumbers}
                >
                  <CodeBlockHeader>
                    <CodeBlockTitle>
                      <CodeBlockFilename>
                        {match[1]}
                      </CodeBlockFilename>
                    </CodeBlockTitle>
                    <CodeBlockActions>
                      <button
                        className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md text-xs font-medium transition-colors hover:bg-muted/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 h-7 w-7 text-muted-foreground"
                        onClick={() => setShowLineNumbers(!showLineNumbers)}
                        type="button"
                        aria-label="Toggle line numbers"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M4 7V4h16v3" />
                          <path d="M9 20h6" />
                          <path d="M12 4v16" />
                        </svg>
                      </button>
                      <CodeBlockCopyButton />
                    </CodeBlockActions>
                  </CodeBlockHeader>
                </CodeBlock>
              );
            }

            return (
              <code
                className={cn(
                  "rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.9em] text-foreground",
                  className
                )}
                {...props}
              >
                {children}
              </code>
            );
          },
          pre({ children }) {
            return <>{children}</>;
          },
        }}
        remarkPlugins={[
          [remarkMath, { singleDollarTextMath: true }],
          remarkGfm,
        ]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false }]]}
      >
        {content}
      </ReactMarkdown>
    );
  }
);

MemoizedMarkdownBlock.displayName = "MemoizedMarkdownBlock";

function parseMarkdownIntoBlocks(markdown: string): string[] {
  const blocks: string[] = [];
  let current = "";
  let inCodeBlock = false;
  let codeFence = "";
  const lines = markdown.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!inCodeBlock && /^```/.test(line)) {
      if (current) {
        blocks.push(current);
        current = "";
      }
      inCodeBlock = true;
      codeFence = line.match(/^`+/)?.[0] ?? "```";
      current = line + "\n";
    } else if (inCodeBlock && line.startsWith(codeFence)) {
      current += line + "\n";
      blocks.push(current);
      current = "";
      inCodeBlock = false;
    } else if (
      !inCodeBlock &&
      /^#{1,6}\s/.test(line)
    ) {
      if (current) {
        blocks.push(current);
        current = "";
      }
      blocks.push(line);
    } else if (
      !inCodeBlock &&
      /^---/.test(line)
    ) {
      if (current) {
        blocks.push(current);
        current = "";
      }
      blocks.push(line);
    } else {
      current += line + (i < lines.length - 1 ? "\n" : "");
    }
  }

  if (current) {
    blocks.push(current);
  }

  return blocks.length > 0 ? blocks : [markdown];
}
