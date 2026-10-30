export function ArrowIcon({
  direction = "up-right",
}: {
  direction?: "up" | "up-right";
}) {
  return (
    <svg
      className="ui-icon"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={direction === "up" ? "M8 13V3m-5 5 5-5 5 5" : "M3 13 13 3M3 3h10v10"}
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ExpandIcon({ expanded = false }: { expanded?: boolean }) {
  return (
    <svg
      className="ui-icon"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={
          expanded
            ? "M2 6h4V2m4 0v4h4M6 14v-4H2m8 4v-4h4"
            : "M6 2H2v4m8-4h4v4M2 10v4h4m8-4v4h-4"
        }
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
