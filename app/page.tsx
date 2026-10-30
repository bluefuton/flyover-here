"use client";
import { useEffect, useRef, useState } from "react";
import ClearSkyIllustration from "../components/clear-sky-illustration";
import FlightNumber from "../components/flight-number";
import AircraftPhoto from "../components/aircraft-photo";
import BrandMark from "../components/brand-mark";
import SkyIllustration from "../components/sky-illustration";
import PositionMap from "../components/position-map";
import { ArrowIcon, ExpandIcon } from "../components/ui-icons";
import { locationOverride } from "../lib/location-override";
import { locationPermission, requestLocation } from "../lib/location";
import { distanceKm, type Aircraft } from "../lib/aircraft";
function Compass({ bearing }: { bearing: number }) {
  return (
    <svg
      viewBox="0 0 40 40"
      aria-hidden="true"
      style={{ transform: `rotate(${bearing}deg)` }}
    >
      <path d="M20 6l8 25-8-5-8 5z" fill="currentColor" />
    </svg>
  );
}
const compass = (n: number) =>
  ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(n / 45) % 8];
const aircraftNames: Record<string, string> = {
  B789: "Boeing 787-9",
  B788: "Boeing 787-8",
  B77W: "Boeing 777-300ER",
  B738: "Boeing 737-800",
  A320: "Airbus A320",
  A321: "Airbus A321",
  A20N: "Airbus A320neo",
  A21N: "Airbus A321neo",
  A359: "Airbus A350-900",
  A388: "Airbus A380",
  AT76: "ATR 72-600",
  DH8D: "De Havilland Dash 8",
  C172: "Cessna 172",
};
export default function Home() {
  const [mode, setMode] = useState<"checking" | "idle" | "locating" | "live">(
    "checking",
  );
  const [position, setPosition] = useState<{ lat: number; lon: number } | null>(
    null,
  );
  const [isOverride, setIsOverride] = useState(false);
  const [locationIssue, setLocationIssue] = useState(false);
  const [aircraft, setAircraft] = useState<Aircraft | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retryAt, setRetryAt] = useState<number | null>(null);
  const [radius, setRadius] = useState(25);
  const [updated, setUpdated] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [fullscreen, setFullscreen] = useState(false);
  const requestId = useRef(0);
  const activeQuery = useRef("");
  const checkedRadius = useRef(25);
  const cancelLocation = useRef<(() => void) | null>(null);
  useEffect(() => {
    let disposed = false;
    let permissionCheck = 0;
    const reuseGrantedLocation = async (check: number) => {
      const granted =
        navigator.geolocation &&
        (await locationPermission(navigator.permissions)) === "granted";
      if (
        disposed ||
        check !== permissionCheck ||
        locationOverride(window.location.search).status !== "absent"
      )
        return;
      if (granted) locate();
      else setMode("idle");
    };
    const applyUrl = (fromHistory = false) => {
      const check = ++permissionCheck;
      cancelLocation.current?.();
      setLocationIssue(false);
      const override = locationOverride(window.location.search);
      if (override.status === "valid") {
        setIsOverride(true);
        setPosition(override.position);
        setMode("live");
        setError("");
      } else if (override.status === "invalid") {
        setIsOverride(false);
        setPosition(null);
        setMode("idle");
        setError(
          "The URL needs valid lat and lon values (−90 to 90, and −180 to 180).",
        );
      } else {
        if (fromHistory) {
          setIsOverride(false);
          setPosition(null);
          setMode("checking");
          setError("");
        }
        void reuseGrantedLocation(check);
      }
    };
    const onHistory = () => applyUrl(true);
    applyUrl();
    window.addEventListener("popstate", onHistory);
    return () => {
      disposed = true;
      cancelLocation.current?.();
      window.removeEventListener("popstate", onHistory);
    };
  }, []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    const f = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", f);
    return () => {
      clearInterval(t);
      document.removeEventListener("fullscreenchange", f);
    };
  }, []);
  useEffect(() => {
    const id = ++requestId.current;
    if (mode !== "live" || !position) return;
    let running = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failureDelay = 15000;
    let nextAt = 0;
    const controller = new AbortController();
    const refresh = async () => {
      if (running || controller.signal.aborted) return;
      clearTimeout(timer);
      if (document.hidden) {
        timer = setTimeout(refresh, 15000);
        return;
      }
      if (Date.now() < nextAt) {
        timer = setTimeout(refresh, nextAt - Date.now());
        return;
      }
      running = true;
      setBusy(true);
      let delay = 15000;
      try {
        const r = await fetch("/api/nearest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...position, radius }),
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(18000),
          ]),
        });
        const d = (await r.json()) as {
          error?: string;
          retryAfter?: number;
          aircraft: Aircraft | null;
          updatedAt: number;
        };
        if (id !== requestId.current) return;
        if (!r.ok) {
          failureDelay = Math.min(Math.max(failureDelay * 2, 30000), 120000);
          delay = Math.max(
            failureDelay,
            Math.min(300000, (d.retryAfter || 0) * 1000),
          );
          throw new Error(d.error || "Flight data is temporarily unavailable.");
        }
        failureDelay = 15000;
        checkedRadius.current = radius;
        setAircraft(d.aircraft);
        setUpdated(d.updatedAt);
        setError("");
        setRetryAt(null);
      } catch (e) {
        if (id === requestId.current && !controller.signal.aborted) {
          if (delay === 15000) {
            failureDelay = Math.min(Math.max(failureDelay * 2, 30000), 120000);
            delay = failureDelay;
          }
          setError(
            e instanceof Error && e.name === "TimeoutError"
              ? "The flight data request timed out."
              : e instanceof Error
                ? e.message
                : "Connection interrupted.",
          );
          setRetryAt(Date.now() + delay);
        }
      } finally {
        running = false;
        if (id === requestId.current && !controller.signal.aborted) {
          setBusy(false);
          nextAt = Date.now() + delay;
          timer = setTimeout(refresh, delay);
        }
      }
    };
    const onVisible = () => {
      if (!document.hidden) void refresh();
    };
    const query = `${position.lat}/${position.lon}`;
    if (activeQuery.current !== query) {
      if (isOverride) {
        setAircraft(null);
        setUpdated(null);
      }
      activeQuery.current = query;
    }
    setRetryAt(null);
    setError("");
    void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      if (requestId.current === id) requestId.current++;
    };
  }, [position, radius, mode, isOverride]);
  useEffect(() => {
    if (mode !== "live" || isOverride || !navigator.geolocation) return;
    const watch = navigator.geolocation.watchPosition(
      (p) => {
        const next = { lat: p.coords.latitude, lon: p.coords.longitude };
        setPosition((previous) =>
          previous &&
          distanceKm(previous.lat, previous.lon, next.lat, next.lon) < 0.1
            ? previous
            : next,
        );
      },
      (error) => {
        if (error.code === 1) {
          setMode("idle");
          setLocationIssue(true);
          setError(
            "Location access is off. Allow location in your browser’s site settings, then try again.",
          );
        }
      },
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [mode, isOverride]);
  const locate = () => {
    cancelLocation.current?.();
    requestId.current++;
    setBusy(false);
    setMode("locating");
    setAircraft(null);
    setUpdated(null);
    setError("");
    setLocationIssue(false);
    cancelLocation.current = requestLocation(
      navigator.geolocation,
      (p) => {
        const url = new URL(window.location.href);
        url.searchParams.delete("lat");
        url.searchParams.delete("lon");
        window.history.replaceState(
          null,
          "",
          url.pathname + url.search + url.hash,
        );
        setIsOverride(false);
        setPosition({ lat: p.coords.latitude, lon: p.coords.longitude });
        setMode("live");
      },
      (reason) => {
        setMode("idle");
        setLocationIssue(true);
        setError(
          reason === "denied"
            ? "Location access is off. Allow location in your browser’s site settings, then try again."
            : reason === "timeout"
              ? "Your browser didn’t return a location. Try again, or open this page in Safari or Chrome."
              : reason === "unsupported"
                ? "Location isn’t supported in this browser. Open this page in Safari or Chrome."
                : "We couldn’t find your location. Check your device’s location settings and try again.",
        );
      },
    );
  };
  const nextRadius = [5, 10, 25, 50, 100].find((r) => r > radius);
  const retrySeconds = retryAt
    ? Math.max(0, Math.ceil((retryAt - now) / 1000))
    : 0;
  const stale =
    mode === "live" &&
    aircraft !== null &&
    updated !== null &&
    now - updated > 45000;
  const visible = stale ? null : aircraft;
  const status = error
    ? "Feed unavailable"
    : busy && !updated
      ? "Finding aircraft"
      : visible
        ? "Nearest aircraft"
        : "No aircraft nearby";
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setError("Full screen isn’t available in this browser.");
    }
  }
  const header = (
    <header className="header">
      <a className="brand" href="/" aria-label="Flyover Here home">
        <BrandMark />
        flyover here
      </a>
    </header>
  );
  const footer = (
    <footer>
      <a
        href="https://www.adsb.lol/docs/open-data/api/"
        target="_blank"
        rel="noreferrer"
      >
        Data: adsb.lol <ArrowIcon />
      </a>
    </footer>
  );
  if (mode === "checking" || mode === "locating")
    return (
      <main className="location-page" aria-busy="true">
        {header}
        <section className="location-resolving" role="status">
          <span className="location-pulse" aria-hidden="true" />
          <p>Finding your sky…</p>
          {mode === "locating" && (
            <button
              className="text-button"
              onClick={() => {
                cancelLocation.current?.();
                setMode("idle");
                setLocationIssue(true);
                setError(
                  "Location lookup cancelled. You can try again when you’re ready.",
                );
              }}
            >
              Cancel
            </button>
          )}
        </section>
        {footer}
      </main>
    );
  if (mode === "idle")
    return (
      <main className="location-page">
        {header}
        <section className="location-gate" aria-labelledby="location-title">
          <SkyIllustration />

          <h1 id="location-title">
            What’s <span>up?</span>
          </h1>
          <div className="gate-bottom">
            <p className="gate-description">
              Enable location to see
              <br />
              the nearest aircraft.
            </p>
            <div className="gate-action">
              <button className="primary" onClick={locate}>
                Enable location
                <span>
                  <ArrowIcon />
                </span>
              </button>
              <p className="gate-helper" role="status">
                {error}
              </p>
              {locationIssue && (
                <p className="gate-helper browser-location-help">
                  Using Facebook’s or Instagram’s browser? Open its ⋯ menu and
                  choose “Open in browser” to use Safari or Chrome.
                </p>
              )}
            </div>
          </div>
          <details className="privacy-note">
            <summary>How your location is used</summary>
            <p>
              Your location is sent to this site and adsb.lol for flight
              lookups. OpenStreetMap receives the map area you view. This app
              doesn’t save your location.
            </p>
          </details>
        </section>
        {footer}
      </main>
    );
  return (
    <main>
      {header}
      <section className="live-heading">
        <div className="section-label">
          <span>01</span>
          <span>NEAREST AIRCRAFT</span>
        </div>
        <div className="feed-status">
          {isOverride && (
            <span className="override-label">Custom location</span>
          )}
          <span className={error || stale ? "status-dot" : "status-dot on"} />
          {error || stale
            ? "Connection interrupted"
            : busy
              ? "Updating"
              : updated
                ? "Live · updates every 15s"
                : "Connecting"}
        </div>
      </section>
      <section className="display" aria-label="Nearest aircraft display">
        {visible ? (
          <>
            <div className="flight-main">
              <div className="flight-identity">
                <FlightNumber
                  callsign={visible.callsign}
                  registration={visible.registration}
                  kind={visible.kind}
                />
                <div className="aircraft-model">
                  <span>
                    {visible.kind === "rotorcraft"
                      ? "Rotorcraft"
                      : visible.kind === "plane"
                        ? "Plane"
                        : ""}
                    {visible.type
                      ? `${visible.kind !== "unknown" ? " · " : ""}${aircraftNames[visible.type] || visible.type}`
                      : visible.kind === "unknown"
                        ? "Unknown aircraft type"
                        : ""}
                  </span>
                  {visible && (
                    <span className="radio-callsign">
                      Callsign {visible.callsign}
                    </span>
                  )}
                </div>
                {visible && (
                  <div className="flight-actions">
                    <a
                      className="flight-link"
                      href={`https://www.flightradar24.com/${visible.latitude.toFixed(4)},${visible.longitude.toFixed(4)}/12`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Live map on Flightradar24 <ArrowIcon />
                    </a>
                    <AircraftPhoto
                      hex={visible.hex}
                      registration={visible.registration}
                      type={visible.type}
                    />
                  </div>
                )}
              </div>
              <div className="distance">
                <span className="board-label">
                  {isOverride ? "DISTANCE FROM LOCATION" : "DISTANCE FROM YOU"}
                </span>
                <div>
                  <span className="distance-number">
                    {visible ? visible.distance.toFixed(1) : "—"}
                  </span>
                  <span className="distance-unit">km</span>
                </div>
                {visible && (
                  <span className="direction">
                    <Compass bearing={visible.bearing} />
                    {compass(visible.bearing)}{" "}
                    {isOverride ? "of location" : "of you"}
                  </span>
                )}
              </div>
            </div>
            <div className="metrics">
              <div>
                <span className="board-label">ALTITUDE</span>
                <strong>
                  {visible
                    ? Math.round(visible.altitude / 3.28084).toLocaleString()
                    : "—"}
                  <small>m</small>
                </strong>
              </div>
              <div>
                <span className="board-label">GROUND SPEED</span>
                <strong>
                  {visible?.speed != null
                    ? Math.round(visible.speed * 1.852).toLocaleString()
                    : "—"}
                  <small>km/h</small>
                </strong>
              </div>
              <div>
                <span className="board-label">HEADING</span>
                <strong>
                  {visible?.track != null
                    ? Math.round(visible.track) + "°"
                    : "—"}
                  <small>
                    {visible?.track != null ? compass(visible.track) : ""}
                  </small>
                </strong>
              </div>
              <div>
                <span className="board-label">VERTICAL RATE</span>
                <strong>
                  {visible?.verticalRate != null
                    ? Math.abs(visible.verticalRate) < 100
                      ? "Level"
                      : (visible.verticalRate > 0 ? "+" : "−") +
                        Math.abs(
                          Math.round(visible.verticalRate),
                        ).toLocaleString()
                    : "—"}
                  <small>
                    {visible?.verticalRate != null &&
                    Math.abs(visible.verticalRate) >= 100
                      ? "ft/min"
                      : ""}
                  </small>
                </strong>
              </div>
            </div>
          </>
        ) : (
          <div className="sky-state" role="status">
            {!error && !stale && updated ? (
              <ClearSkyIllustration />
            ) : (
              <div className="empty-cloud" aria-hidden="true">
                <BrandMark />
              </div>
            )}
            <h2>
              {error
                ? "A moment of radio silence."
                : stale
                  ? "Reconnecting to your sky."
                  : updated
                    ? "Clear skies for now."
                    : "Checking the sky…"}
            </h2>
            <p>
              {error ||
                (stale
                  ? "The last position is out of date. We’re reconnecting automatically."
                  : updated
                    ? `No airborne aircraft reported within ${checkedRadius.current} km. We’ll keep looking.`
                    : `Looking for nearby aircraft within ${radius} km.`)}
            </p>
            {error && retryAt && (
              <p className="retry-note">
                {busy ? "Retrying…" : `Trying again in ${retrySeconds}s`}
              </p>
            )}
            {!error && !stale && updated && nextRadius !== undefined && (
              <button
                className="empty-radius"
                disabled={busy}
                onClick={() => setRadius(nextRadius!)}
              >
                Look within {nextRadius} km{" "}
                <span aria-hidden="true">
                  <ArrowIcon />
                </span>
              </button>
            )}
          </div>
        )}
        {(visible || (!error && !stale)) && (
          <div className="updated" aria-live="polite">
            {error ||
              (stale
                ? "Positions are out of date. Reconnecting…"
                : updated
                  ? `Updated ${Math.max(0, Math.floor((now - updated) / 1000))}s ago`
                  : busy
                    ? "Retrieving live positions…"
                    : "Waiting for aircraft data.")}
          </div>
        )}
      </section>
      {position && (
        <PositionMap
          position={position}
          aircraft={visible}
          referenceLabel={isOverride ? "Location" : "You"}
        />
      )}
      <div className="settings">
        <div className="settings-left">
          <label htmlFor="radius">RANGE</label>
          <select
            id="radius"
            aria-label="Search radius"
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
          >
            <option value={5}>5 km</option>
            <option value={10}>10 km</option>
            <option value={25}>25 km</option>
            <option value={50}>50 km</option>
            <option value={100}>100 km</option>
          </select>
        </div>
        <div className="settings-right">
          {isOverride && (
            <button className="text-button" onClick={locate}>
              Use my location <ArrowIcon />
            </button>
          )}
          <button className="text-button" onClick={toggleFullscreen}>
            {fullscreen ? "Exit full screen" : "Full screen"}{" "}
            <ExpandIcon expanded={fullscreen} />
          </button>
        </div>
      </div>
      <div className="data-footer">
        <details
          className="data-note"
          onToggle={(event) => {
            const details = event.currentTarget;
            if (!details.open) return;
            requestAnimationFrame(() => {
              if (!details.open || !details.isConnected) return;
              const bounds = details.getBoundingClientRect();
              if (bounds.bottom > window.innerHeight || bounds.top < 0) {
                details.scrollIntoView({
                  block: "start",
                  behavior: window.matchMedia(
                    "(prefers-reduced-motion: reduce)",
                  ).matches
                    ? "instant"
                    : "smooth",
                });
              }
            });
          }}
        >
          <summary aria-controls="flight-data-content">
            About this flight data <span aria-hidden="true">+</span>
          </summary>
          <p id="flight-data-content">
            We select the airborne aircraft with the shortest ground distance
            from you. Nearby doesn’t always mean directly overhead. Reports
            older than 30 seconds and grounded aircraft are excluded. Coverage
            varies. Altitude is barometric, not height above your location. Data
            from{" "}
            <a
              href="https://www.adsb.lol/docs/open-data/api/"
              target="_blank"
              rel="noreferrer"
            >
              adsb.lol
            </a>
            , licensed under{" "}
            <a
              href="https://opendatacommons.org/licenses/odbl/1-0/"
              target="_blank"
              rel="noreferrer"
            >
              ODbL 1.0
            </a>
            . Flight numbers are looked up using{" "}
            <a href="https://www.adsbdb.com/" target="_blank" rel="noreferrer">
              adsbdb
            </a>{" "}
            when a callsign match is available. Aircraft photos are matched by
            ICAO aircraft ID and provided by Planespotters.net with photographer
            credit. They may show an earlier livery. For curiosity, not
            navigation.
          </p>
        </details>
        {footer}
      </div>
    </main>
  );
}
