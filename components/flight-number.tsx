"use client";
import { useEffect, useState } from "react";
import type { AircraftKind } from "../lib/aircraft";
import type { FlightAirport, FlightInformation } from "../lib/flight";
import { ArrowIcon } from "./ui-icons";

function AirportLabel({
  airport,
  label,
}: {
  airport: FlightAirport;
  label: string;
}) {
  const name = airport.city || airport.name || airport.code;
  return (
    <span className="route-airport" title={airport.name || undefined}>
      <span className="route-label">{label}</span> {name}
      {airport.code && airport.code !== name && (
        <span className="airport-code"> {airport.code}</span>
      )}
    </span>
  );
}
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
    flight: FlightInformation | null;
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
            flight: (data as { flight: FlightInformation | null }).flight,
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
      {(flight?.origin || flight?.destination) && (
        <p className="flight-route" title="Route reported by adsbdb">
          {flight.origin && (
            <AirportLabel airport={flight.origin} label="From" />
          )}
          {flight.origin && flight.destination && (
            <ArrowIcon direction="right" />
          )}
          {flight.destination && (
            <AirportLabel airport={flight.destination} label="To" />
          )}
        </p>
      )}
    </>
  );
}
