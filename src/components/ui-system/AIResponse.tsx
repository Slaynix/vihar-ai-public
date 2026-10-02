import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/**
 * The single renderer for every AI answer in the app.
 * Markdown is always parsed (never shown raw), with typography tuned for
 * scanning: short paragraphs, spaced headings, readable tables and code.
 */
function AIResponseImpl({ children, className }: { children: string; className?: string }) {
  return (
    <div
      className={cn(
        "ai-prose max-w-none text-[0.9375rem] leading-[1.75] text-[oklch(0.9_0.02_220)]",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h3 className="font-display text-base text-glow-cyan mt-5 mb-2 first:mt-0">{children}</h3>
          ),
          h2: ({ children }) => (
            <h4 className="font-display text-sm text-glow-cyan mt-5 mb-2 first:mt-0">{children}</h4>
          ),
          h3: ({ children }) => (
            <h5 className="hud-text text-[11px] text-[oklch(0.82_0.16_220)] mt-4 mb-2 first:mt-0">
              {children}
            </h5>
          ),
          h4: ({ children }) => (
            <h6 className="hud-text text-[11px] text-[oklch(0.82_0.16_220)] mt-4 mb-2 first:mt-0">
              {children}
            </h6>
          ),
          p: ({ children }) => <p className="my-2.5 first:mt-0 last:mb-0">{children}</p>,
          strong: ({ children }) => (
            <strong className="font-semibold text-[oklch(0.96_0.04_200)]">{children}</strong>
          ),
          ul: ({ children }) => <ul className="my-2.5 space-y-1.5 pl-5 list-disc marker:text-[oklch(0.75_0.16_200)]">{children}</ul>,
          ol: ({ children }) => <ol className="my-2.5 space-y-1.5 pl-5 list-decimal marker:text-[oklch(0.75_0.16_200)]">{children}</ol>,
          li: ({ children }) => <li className="pl-1 leading-relaxed">{children}</li>,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="text-[oklch(0.85_0.18_200)] underline underline-offset-2 break-words"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-2 border-[oklch(0.7_0.15_220/0.5)] pl-3 text-muted-foreground">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-4 border-[oklch(0.7_0.15_220/0.2)]" />,
          table: ({ children }) => (
            <div className="my-3 -mx-1 overflow-x-auto">
              <table className="w-full min-w-[22rem] border-collapse text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-[oklch(0.7_0.15_220/0.25)] bg-[oklch(0.16_0.05_270/0.6)] px-2.5 py-1.5 text-left hud-text text-[10px] text-[oklch(0.82_0.16_220)]">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-[oklch(0.7_0.15_220/0.2)] px-2.5 py-1.5 align-top">
              {children}
            </td>
          ),
          code: ({ className: cls, children, ...rest }) => {
            const lang = /language-(\w+)/.exec(cls || "")?.[1];
            const isBlock = Boolean(lang) || String(children).includes("\n");
            if (!isBlock) {
              return (
                <code
                  className="rounded bg-[oklch(0.18_0.05_270/0.8)] px-1.5 py-0.5 font-mono text-[0.85em] text-[oklch(0.9_0.1_180)]"
                  {...rest}
                >
                  {children}
                </code>
              );
            }
            return (
              <span className="relative block">
                {lang && (
                  <span className="absolute right-2 top-2 hud-text text-[9px] text-[oklch(0.6_0.1_220)]">
                    {lang}
                  </span>
                )}
                <code className={cn("block font-mono text-[0.85em] leading-relaxed", cls)} {...rest}>
                  {children}
                </code>
              </span>
            );
          },
          pre: ({ children }) => (
            <pre className="my-3 overflow-x-auto rounded-lg border border-[oklch(0.7_0.15_220/0.2)] bg-[oklch(0.08_0.03_270/0.9)] p-3">
              {children}
            </pre>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

export const AIResponse = memo(AIResponseImpl);
