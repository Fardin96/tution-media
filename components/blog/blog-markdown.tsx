import ReactMarkdown, { type Components } from "react-markdown";
import { cn } from "@/lib/utils";

// Raw HTML in a post is not rendered (react-markdown escapes it; rehype-raw is not used).
const components: Components = {
  h1: ({ children }) => <h2 className={headingClass}>{children}</h2>,
  h2: ({ children }) => <h2 className={headingClass}>{children}</h2>,
  h3: ({ children }) => (
    <h3 className="mt-8 text-xl font-semibold tracking-tight text-balance text-[var(--color-neutral-charcoal)]">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-6 text-lg font-semibold text-[var(--color-neutral-charcoal)]">
      {children}
    </h4>
  ),
  p: ({ children }) => <p className="mt-5 first:mt-0">{children}</p>,
  ul: ({ children }) => (
    <ul className="mt-5 list-disc space-y-2 ps-6 marker:text-[var(--color-text-secondary)]">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mt-5 list-decimal space-y-2 ps-6 marker:text-[var(--color-text-secondary)]">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="ps-1">{children}</li>,
  a: ({ href, children }) => {
    const external = href?.startsWith("http");
    return (
      <a
        href={href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="font-medium text-[var(--color-primary-deep)] underline decoration-1 underline-offset-4 hover:decoration-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary-core)]"
      >
        {children}
      </a>
    );
  },
  blockquote: ({ children }) => (
    <blockquote className="mt-6 border-s-4 border-[var(--color-secondary-sky)] ps-5 text-[var(--color-text-secondary)] italic [&_p]:mt-0">
      {children}
    </blockquote>
  ),
  pre: ({ children }) => (
    <pre className="mt-6 overflow-x-auto rounded-[16px] bg-[var(--color-neutral-off-white)] p-4 text-sm leading-relaxed [&_code]:bg-transparent [&_code]:p-0">
      {children}
    </pre>
  ),
  code: ({ children, className }) => (
    <code
      className={cn(
        "font-mono text-[0.9em] break-words",
        !className &&
          "rounded-md bg-[var(--color-neutral-off-white)] px-1.5 py-0.5",
      )}
    >
      {children}
    </code>
  ),
  hr: () => <hr className="my-10 border-black/10" />,
  img: ({ src, alt }) => (
    // eslint-disable-next-line @next/next/no-img-element -- R2 URLs are not configured for next/image.
    <img
      src={src}
      alt={alt ?? ""}
      loading="lazy"
      className="mt-6 w-full rounded-[16px] outline outline-1 -outline-offset-1 outline-black/10"
    />
  ),
};

const headingClass =
  "mt-10 text-2xl font-semibold tracking-tight text-balance text-[var(--color-neutral-charcoal)] first:mt-0";

/** A post body: markdown with readable prose sizes and a 65ch measure. */
export function BlogMarkdown({
  source,
  className,
}: {
  source: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "max-w-[65ch] text-[17px] leading-relaxed text-pretty break-words text-[var(--color-neutral-charcoal)]",
        className,
      )}
    >
      <ReactMarkdown components={components}>{source}</ReactMarkdown>
    </div>
  );
}
