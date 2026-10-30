import type { AircraftKind } from "../lib/aircraft";

export default function AircraftSymbol({
  kind,
  heading,
}: {
  kind: AircraftKind;
  heading: number;
}) {
  return (
    <svg
      viewBox="0 0 40 40"
      style={{ transform: `rotate(${heading}deg)` }}
      aria-hidden="true"
    >
      {kind === "rotorcraft" ? (
        <>
          <path
            d="m18 24-1 13h6l-1-13"
            fill="currentColor"
            stroke="white"
            strokeWidth="1"
          />
          <path
            d="M20 6c-4 0-6 5-6 11s2 10 6 10 6-4 6-10S24 6 20 6Z"
            fill="currentColor"
            stroke="white"
            strokeWidth="1"
          />
          <path
            d="M4 16h32M14 34h12"
            stroke="white"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M4 16h32M14 34h12"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </>
      ) : kind === "plane" ? (
        <path
          d="M20 3l3 12 12 8v4l-12-4v9l4 3v2l-7-2-7 2v-2l4-3v-9L5 27v-4l12-8z"
          fill="currentColor"
          stroke="white"
          strokeWidth="1"
        />
      ) : (
        <path
          d="m20 6 10 25-10-6-10 6Z"
          fill="currentColor"
          stroke="white"
          strokeWidth="1.5"
        />
      )}
    </svg>
  );
}
