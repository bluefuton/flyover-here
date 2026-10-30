import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function moduleUrl(path, imports = {}) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  let js = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  for (const [specifier, url] of Object.entries(imports))
    js = js
      .replaceAll(`'${specifier}'`, JSON.stringify(url))
      .replaceAll(`"${specifier}"`, JSON.stringify(url));
  return `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
}
const aircraftUrl = await moduleUrl("../lib/aircraft.ts");
const { nearestAircraft, distanceKm } = await import(aircraftUrl);
const { mapLayout, project } = await import(await moduleUrl("../lib/map.ts"));
const { locationOverride } = await import(
  await moduleUrl("../lib/location-override.ts")
);

test("nearest selection excludes grounded, stale, invalid and out-of-range aircraft", () => {
  const base = {
    hex: "abcdef",
    lat: 0.01,
    lon: 0,
    alt_baro: 5000,
    seen_pos: 1,
    flight: " TEST123 ",
  };
  assert.equal(distanceKm(0, 0, 0, 0), 0);
  assert.ok(Math.abs(distanceKm(0, 0, 0, 1) - 111.195) < 0.01);
  assert.equal(
    nearestAircraft([{ ...base, hex: "aaaaaa", lat: 0.1 }, base], 0, 0)
      ?.callsign,
    "TEST123",
  );
  assert.equal(
    nearestAircraft(
      [
        { ...base, alt_baro: "ground" },
        { ...base, seen_pos: 31 },
        { ...base, lat: 1 },
        { ...base, lat: null },
        { ...base, hex: "invalid" },
      ],
      0,
      0,
    ),
    null,
  );
  assert.equal(nearestAircraft([base], 0, 0)?.bearing, 0);
  assert.equal(nearestAircraft([base], 0, 0, 0.5), null);
  assert.equal(nearestAircraft([], 0, 0), null);
});

test("map fits both positions on narrow/wide screens and across the dateline", () => {
  assert.deepEqual(project(0, 0), { x: 0.5, y: 0.5 });
  for (const [lat, lon, a, b] of [
    [-36.85, 174.76, -36.91, 174.82],
    [0, 179.99, 0, -179.99],
    [85, 10, 85.1, 10.1],
    [0, 0, 0, 0],
  ]) {
    for (const width of [320, 1000]) {
      const layout = mapLayout(
        { lat, lon },
        { latitude: a, longitude: b },
        width,
        275,
      );
      for (const point of [layout.user, layout.plane]) {
        assert.ok(point.x >= 0 && point.x <= width);
        assert.ok(point.y >= 0 && point.y <= 275);
      }
    }
  }
});

test("URL location overrides validate coordinates without treating zero as missing", () => {
  assert.deepEqual(locationOverride("?lat=51.4700&lon=-0.4543"), {
    status: "valid",
    position: { lat: 51.47, lon: -0.4543 },
  });
  assert.deepEqual(locationOverride("?lat=0&lon=0"), {
    status: "valid",
    position: { lat: 0, lon: 0 },
  });
  assert.equal(locationOverride("?lat=-90&lon=180").status, "valid");
  for (const query of [
    "?lat=91&lon=0",
    "?lat=0&lon=181",
    "?lat=NaN&lon=0",
    "?lat=1",
    "?lon=1",
    "?lat=&lon=0",
    "?lat=Infinity&lon=0",
  ])
    assert.equal(locationOverride(query).status, "invalid");
  assert.equal(locationOverride("?other=1").status, "absent");
});

test("feed handler shares requests, ages cached positions and identifies provider failures", async () => {
  const routeUrl = await moduleUrl("../app/api/nearest/route.ts", {
    "../../../lib/aircraft": aircraftUrl,
  });
  const realFetch = globalThis.fetch;
  const realNow = Date.now;
  let time = 1800000000000;
  Date.now = () => time;
  const request = (body = { lat: 51.47, lon: -0.45, radius: 25 }) =>
    new Request("http://localhost/api/nearest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const aircraft = {
    hex: "abcdef",
    lat: 51.47,
    lon: -0.45,
    alt_baro: 5000,
    seen_pos: 29,
    flight: "TEST123",
  };
  try {
    let count = 0;
    globalThis.fetch = async () => {
      count++;
      return Response.json({ ac: [aircraft] });
    };
    const { POST } = await import(routeUrl + "#success");
    const [one, two] = await Promise.all([POST(request()), POST(request())]);
    assert.equal(count, 1);
    assert.equal(one.status, 200);
    assert.equal((await two.json()).aircraft.callsign, "TEST123");
    time += 2000;
    assert.equal((await (await POST(request())).json()).aircraft, null);
    assert.equal(count, 1);
    assert.equal(
      (await POST(request({ lat: 91, lon: 0, radius: 25 }))).status,
      400,
    );
    assert.equal((await POST(request(null))).status, 400);
    assert.equal(
      (await POST(request({ lat: 51.47, lon: -0.45, radius: 100 }))).status,
      200,
    );
    globalThis.fetch = async () =>
      new Response("{}", { status: 429, headers: { "Retry-After": "45" } });
    const limited = await (await import(routeUrl + "#limited")).POST(request());
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get("Retry-After"), "45");
    assert.equal((await limited.json()).kind, "rate_limited");
    globalThis.fetch = async () => {
      throw new DOMException("timed out", "TimeoutError");
    };
    const timeout = await (await import(routeUrl + "#timeout")).POST(request());
    assert.equal(timeout.status, 504);
    assert.equal((await timeout.json()).kind, "timeout");
    globalThis.fetch = async () => new Response("{}", { status: 503 });
    assert.equal(
      (await (await import(routeUrl + "#unavailable")).POST(request())).status,
      503,
    );
  } finally {
    globalThis.fetch = realFetch;
    Date.now = realNow;
  }
});

test("flight metadata retains operator names without inventing passenger flight numbers", async () => {
  const routeUrl = await moduleUrl("../app/api/flight-number/route.ts");
  const realFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => {
      const callsign = String(url).split("/").at(-1);
      if (String(url).includes("/airline/"))
        return Response.json({
          response: [{ icao: "SHT", name: "British Airways Shuttle" }],
        });
      if (callsign === "SHT8R")
        return Response.json({ response: "unknown callsign" }, { status: 404 });
      const examples = {
        JAL42: ["JL42", "Japan Airlines"],
        BAW396U: ["BA396U", "British Airways"],
        VKG576: ["576", "SunClass Airlines"],
      };
      const [number, name] = examples[callsign];
      return Response.json({
        response: {
          flightroute: {
            callsign_icao: callsign,
            callsign_iata: number,
            airline: { name },
          },
        },
      });
    };
    const { GET } = await import(routeUrl);
    for (const [callsign, number, airline] of [
      ["JAL42", "JL42", "Japan Airlines"],
      ["BAW396U", null, "British Airways"],
      ["VKG576", null, "SunClass Airlines"],
      ["SHT8R", null, "British Airways Shuttle"],
    ]) {
      const result = await (
        await GET(
          new Request(
            `http://localhost/api/flight-number?callsign=${callsign}`,
          ),
        )
      ).json();
      assert.deepEqual(result.flight, { number, airline });
    }
  } finally {
    globalThis.fetch = realFetch;
  }
});
