"use client";

import type { ComponentProps, HTMLAttributes } from "react";
import type { BundledLanguage } from "shiki";

import { cn } from "@/lib/utils";
import { memo, useDeferredValue, useEffect, useMemo, useState } from "react";
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
  children: string | null | undefined;
  id: string;
  isStreaming?: boolean;
  maxInitialChars?: number;
  maxIncrementChars?: number;
  components?: ComponentProps<typeof ReactMarkdown>["components"];
  remarkPlugins?: ComponentProps<typeof ReactMarkdown>["remarkPlugins"];
  rehypePlugins?: ComponentProps<typeof ReactMarkdown>["rehypePlugins"];
};

const DEFAULT_INITIAL_CHARS = 32_000;
const DEFAULT_INCREMENT_CHARS = 32_000;
const MAX_TEXT_BLOCK_CHARS = 6000;

export const MemoizedMarkdown = memo(
  ({
    children,
    className,
    id,
    isStreaming = false,
    maxInitialChars = DEFAULT_INITIAL_CHARS,
    maxIncrementChars = DEFAULT_INCREMENT_CHARS,
    ...props
  }: MemoizedMarkdownProps) => {
    const content = children ?? "";
    const deferredContent = useDeferredValue(content);
    const renderContent = isStreaming ? deferredContent : content;
    const blocks = useMemo(
      () => parseMarkdownIntoBlocks(renderContent),
      [renderContent]
    );
    const [visibleChars, setVisibleChars] = useState(maxInitialChars);

    useEffect(() => {
      setVisibleChars(maxInitialChars);
    }, [id, maxInitialChars]);

    const { hasMore, renderedBlocks } = useMemo(
      () => getVisibleBlocks(blocks, visibleChars),
      [blocks, visibleChars]
    );

    return (
      <div className={className}>
        {renderedBlocks.map((block, index) => (
          <MemoizedMarkdownBlock
            {...props}
            content={block}
            key={`${id}-block-${index}`}
          />
        ))}
        {hasMore && (
          <button
            className="mt-2 rounded-md border border-border/40 px-2 py-1 text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground"
            onClick={() =>
              setVisibleChars((current) => current + maxIncrementChars)
            }
            type="button"
          >
            Show more
          </button>
        )}
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

function getVisibleBlocks(blocks: string[], visibleChars: number) {
  const renderedBlocks: string[] = [];
  let renderedChars = 0;

  for (const block of blocks) {
    const nextRenderedChars = renderedChars + block.length;

    if (renderedBlocks.length > 0 && nextRenderedChars > visibleChars) {
      return { hasMore: true, renderedBlocks };
    }

    renderedBlocks.push(block);
    renderedChars = nextRenderedChars;
  }

  return { hasMore: false, renderedBlocks };
}

function pushTextBlocks(blocks: string[], text: string) {
  if (!text) {
    return;
  }

  if (text.length <= MAX_TEXT_BLOCK_CHARS) {
    blocks.push(text);
    return;
  }

  const paragraphs = text.split(/(\n{2,})/);
  let current = "";

  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length > MAX_TEXT_BLOCK_CHARS) {
      blocks.push(current);
      current = "";
    }

    if (paragraph.length > MAX_TEXT_BLOCK_CHARS) {
      for (
        let index = 0;
        index < paragraph.length;
        index += MAX_TEXT_BLOCK_CHARS
      ) {
        blocks.push(paragraph.slice(index, index + MAX_TEXT_BLOCK_CHARS));
      }
      continue;
    }

    current += paragraph;
  }

  if (current) {
    blocks.push(current);
  }
}

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
        pushTextBlocks(blocks, current);
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
        pushTextBlocks(blocks, current);
        current = "";
      }
      blocks.push(line);
    } else if (
      !inCodeBlock &&
      /^---/.test(line)
    ) {
      if (current) {
        pushTextBlocks(blocks, current);
        current = "";
      }
      blocks.push(line);
    } else {
      current += line + (i < lines.length - 1 ? "\n" : "");
    }
  }

  if (current) {
    pushTextBlocks(blocks, current);
  }

  return blocks.length > 0 ? blocks : [markdown];
}
