"use client";
import { useEffect, useRef, useState } from "react";
import type { Aircraft } from "../lib/aircraft";
import { mapLayout } from "../lib/map";
import AircraftSymbol from "./aircraft-symbol";
import { ArrowIcon } from "./ui-icons";
export default function PositionMap({
  position,
  aircraft,
  referenceLabel = "You",
}: {
  referenceLabel?: string;
  position: { lat: number; lon: number };
  aircraft: Aircraft | null;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [tileError, setTileError] = useState(false);
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const layout = mapLayout(
    position,
    aircraft,
    size.width || 700,
    size.height || 300,
  );
  const { z, left, top, user, plane } = layout;
  const tiles = [];
  const n = 2 ** z;
  if (size.width)
    for (
      let x = Math.floor(left / 256);
      x <= Math.floor((left + size.width) / 256);
      x++
    )
      for (
        let y = Math.floor(top / 256);
        y <= Math.floor((top + size.height) / 256);
        y++
      ) {
        if (y < 0 || y >= n) continue;
        tiles.push(
          <img
            alt=""
            draggable={false}
            key={`${z}/${x}/${y}`}
            src={`https://tile.openstreetmap.org/${z}/${((x % n) + n) % n}/${y}.png`}
            width={256}
            height={256}
            style={{ left: x * 256 - left, top: y * 256 - top }}
            onError={() => setTileError(true)}
            onLoad={() => setTileError(false)}
          />,
        );
      }
  return (
    <section
      className="map-section"
      aria-label="Reference position and the nearest aircraft"
    >
      <div className="map-heading">
        <div className="section-label">
          <span>02</span>
          <span>POSITION</span>
        </div>
        <div className="map-legend">
          <span>
            <i className="legend-you" />
            {referenceLabel}
          </span>
          <span>
            <i className="legend-plane" />
            Aircraft
          </span>
        </div>
      </div>
      <div
        ref={container}
        className="position-map"
        role="img"
        aria-label={
          aircraft
            ? `${aircraft.callsign}, ${aircraft.distance.toFixed(1)} kilometres from ${referenceLabel === "You" ? "your location" : "the custom location"}. North is up.`
            : `${referenceLabel === "You" ? "Your current location" : "Custom location"}. No aircraft selected.`
        }
      >
        <div className="map-tiles">{tiles}</div>
        {size.width > 0 && (
          <>
            <svg
              className="map-line"
              width={size.width}
              height={size.height}
              aria-hidden="true"
            >
              {aircraft && (
                <line
                  x1={user.x}
                  y1={user.y}
                  x2={plane.x}
                  y2={plane.y}
                  stroke="#242424"
                  strokeWidth="1"
                  strokeDasharray="3 5"
                />
              )}
            </svg>
            <div className="user-marker" style={{ left: user.x, top: user.y }}>
              <span />
              <b>{referenceLabel}</b>
            </div>
            {aircraft && (
              <div
                className="aircraft-marker"
                style={{ left: plane.x, top: plane.y }}
              >
                <AircraftSymbol
                  kind={aircraft.kind}
                  heading={aircraft.track ?? 0}
                />
                <b>{aircraft.callsign}</b>
              </div>
            )}
          </>
        )}
        <span className="map-north">
          N <ArrowIcon direction="up" />
        </span>
        {tileError && <span className="map-error">Map tiles unavailable</span>}
        <a
          className="map-attribution"
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          © OpenStreetMap contributors
        </a>
      </div>
    </section>
  );
}
