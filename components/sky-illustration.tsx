export default function SkyIllustration() {
  return (
    <svg
      className="sky-illustration"
      viewBox="0 0 580 450"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="371" cy="182" r="144" fill="#d4e8ff" />
      <path
        d="M32 154c0-17 14-31 31-31 4-28 27-49 56-49 28 0 51 21 55 47 22-5 43 11 43 33 0 18-14 31-33 31H64c-18 0-32-13-32-31Z"
        fill="#b0d1f8"
      />
      <path
        d="M369 114c0-15 12-27 27-27 4-23 24-41 48-41s45 18 48 42c19-4 37 9 37 28 0 15-12 27-28 27H397c-16 0-28-12-28-29Z"
        fill="#fffdf6"
      />
      <path
        d="M93 319c68 17 111 18 158-19"
        stroke="#709bce"
        strokeWidth="2"
        strokeDasharray="5 9"
        strokeLinecap="round"
      />
      <g
        transform="rotate(-12 300 230)"
        stroke="#214c7e"
        strokeWidth="2"
        strokeLinejoin="round"
      >
        {/* Far wing and tail sit behind the fuselage. */}
        <path d="m266 216-57-59h25l94 61" fill="#a8cdf3" />
        <path d="m143 222-28-76h29l61 76" fill="#427fc1" />
        <path d="m128 208-31-21h25l51 28" fill="#a8cdf3" />
        {/* A rounded nose, tapered tail, and a continuous cabin line. */}
        <path
          d="M111 217c45-3 86-6 129-6h151c26 0 43 8 59 20 6 5 8 11-2 17-13 8-32 11-58 11H232c-52 0-89-15-121-27l-21-9 21-6Z"
          fill="#fffdf6"
        />
        <path
          d="M114 232c37 7 76 14 121 14h163c24 0 42-3 55-9 3 4 1 8-5 11-13 8-32 11-58 11H232c-52 0-89-15-121-27Z"
          fill="#78a9df"
          stroke="none"
        />
        <path d="m418 220 15 6 8 7h-22Z" fill="#214c7e" stroke="none" />
        {Array.from({ length: 13 }, (_, i) => (
          <rect
            key={i}
            x={231 + i * 12}
            y="222"
            width="5"
            height="7"
            rx="2"
            fill="#214c7e"
            stroke="none"
          />
        ))}
        <rect
          x="210"
          y="221"
          width="9"
          height="18"
          rx="3"
          stroke="#8fafd1"
          strokeWidth="1.2"
        />
        {/* Engine and swept near wing. */}
        <path
          d="M293 260h32c9 0 13 4 13 10s-5 10-14 10h-28c-8 0-13-4-13-10s3-10 10-10Z"
          fill="#427fc1"
        />
        <ellipse cx="330" cy="270" rx="7" ry="10" fill="#214c7e" />
        <path d="m280 237-74 77h29l111-72" fill="#c1dcf7" />
        <path d="m280 237 66 5-111 72h-29" stroke="#214c7e" />
        <path d="m133 234-41 20h28l66-13" fill="#c1dcf7" />
      </g>
      <path
        d="M330 370c0-17 14-31 31-31 4-28 27-49 56-49 28 0 51 21 55 47 22-5 43 11 43 33 0 18-14 31-33 31H362c-18 0-32-13-32-31Z"
        fill="#82b1e8"
      />
      <path
        d="M18 351c0-12 10-22 22-22 4-19 20-33 40-33 19 0 36 14 39 33 15-3 30 8 30 23 0 13-10 22-23 22H41c-13 0-23-10-23-23Z"
        fill="#fffdf6"
      />
      <path
        d="m250 63 0 12m-6-6h12M534 233v10m-5-5h10"
        stroke="#729bca"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
