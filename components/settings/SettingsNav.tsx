"use client";

import { useEffect, useState } from "react";

/**
 * The prototype's sticky `.settings-nav` section jumplist
 * (design-prototypes/tempo-focus/index.html's `.settings-layout`). The page
 * itself stays a server component so `CALENDAR_FEED_SECRET` is read straight
 * from the environment (see app/settings/page.tsx) — only this nav, which
 * needs `IntersectionObserver` to track scroll position, is a client child.
 */
export default function SettingsNav({ sections }: { sections: { id: string; label: string }[] }) {
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    const elements = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        // Closest to the top of the scroll container wins.
        const top = visible.reduce((a, b) => (a.boundingClientRect.top <= b.boundingClientRect.top ? a : b));
        setActive(top.target.id);
      },
      { rootMargin: "-10% 0px -70% 0px", threshold: [0, 1] },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav
      aria-label="Settings sections"
      className="flex shrink-0 flex-col gap-0.5 shell:sticky shell:top-0 shell:self-start shell:border-r shell:border-border/70 shell:pr-4"
    >
      <ul className="flex flex-col gap-0.5">
        {sections.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
              aria-current={active === s.id ? "true" : undefined}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                active === s.id
                  ? "bg-accent/10 font-semibold text-accent"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {s.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
