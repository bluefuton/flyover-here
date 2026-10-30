"use client";
import { useEffect, useState } from "react";
import type { AircraftKind } from "../lib/aircraft";
type Flight = { number: string | null; airline: string | null };
export default function FlightIdentity({
  callsign,
  registration,
  kind,
}: {
  callsign: string;
  registration: string | null;
  kind: AircraftKind;
}) {
  const [result, setResult] = useState<{
    callsign: string;
    flight: Flight | null;
  } | null>(null);
  useEffect(() => {
    if (kind === "rotorcraft") return;
    const controller = new AbortController();
    fetch(`/api/flight-number?callsign=${encodeURIComponent(callsign)}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : { flight: null }))
      .then((data) => {
        if (!controller.signal.aborted)
          setResult({
            callsign,
            flight: (data as { flight: Flight | null }).flight,
          });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ callsign, flight: null });
      });
    return () => controller.abort();
  }, [callsign, kind]);
  const flight =
    kind !== "rotorcraft" && result?.callsign === callsign
      ? result.flight
      : null;
  return (
    <>
      <span className="board-label">
        {registration ? "REGISTRATION" : "CALLSIGN"}
      </span>
      <h1 className="registration-title">{registration || callsign}</h1>
      {(flight?.airline || flight?.number) && (
        <div className="aircraft-operator">
          {flight.airline && (
            <span className="airline-name">{flight.airline}</span>
          )}
          {flight.number && (
            <span className="passenger-flight">
              <span>Flight</span> {flight.number}
            </span>
          )}
        </div>
      )}
    </>
  );
}
