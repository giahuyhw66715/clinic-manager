import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ExpandableTextProps {
  text?: string | null;
  emptyText: string;
  className?: string;
}

export function ExpandableText({ text, emptyText, className }: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () =>
      setOverflows(el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1);
    if (!expanded) {
      check();
    }
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [text, expanded]);

  if (!text) {
    return <p className={className}>{emptyText}</p>;
  }

  return (
    <p
      ref={ref}
      onClick={() => {
        if (overflows || expanded) setExpanded((e) => !e);
      }}
      className={cn(
        className,
        (overflows || expanded) && "cursor-pointer",
        !expanded && "truncate",
      )}
    >
      {text}
    </p>
  );
}
