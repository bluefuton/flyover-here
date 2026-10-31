export type FlightAirport = {
  name: string | null;
  city: string | null;
  code: string | null;
};

export type FlightInformation = {
  number: string | null;
  airline: string | null;
  origin: FlightAirport | null;
  destination: FlightAirport | null;
};
