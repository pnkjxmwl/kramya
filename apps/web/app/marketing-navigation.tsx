"use client";

import Link from "next/link";
import { useRef } from "react";
import { Icon } from "../components/icon";

/** Native disclosure works before hydration; selection and Escape close it after. */
export function MarketingNavigation() {
  const menu = useRef<HTMLDetailsElement>(null);
  return (
    <details
      ref={menu}
      className="marketing-mobile-nav"
      onKeyDown={(event) => {
        if (event.key === "Escape" && menu.current?.open) {
          menu.current.open = false;
          menu.current.querySelector("summary")?.focus();
        }
      }}
    >
      <summary aria-label="Open navigation">
        <Icon name="menu" />
      </summary>
      <nav
        aria-label="Mobile navigation"
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a") && menu.current)
            menu.current.open = false;
        }}
      >
        <a href="#product">Product</a>
        <a href="#workflow">For your team</a>
        <a href="#questions">Questions</a>
        <Link href="/login">Staff sign in</Link>
      </nav>
    </details>
  );
}
