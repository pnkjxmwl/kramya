/** Original ticket K from the approved Daylight study. Inherits colour in light/dark contexts. */
export function Mark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <path
        d="M10 7h20a4 4 0 0 1 4 4v5a4 4 0 0 0 0 8v5a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4v-5a4 4 0 0 0 0-8v-5a4 4 0 0 1 4-4Z"
        fill="currentColor"
      />
      <path
        d="M14 13v14m5-7 7-7m-7 7 7 7"
        stroke="var(--mark-cutout,#FAF7F2)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
