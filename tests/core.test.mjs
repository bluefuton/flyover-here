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
const { nearestAircraft, distanceKm, aircraftKind } = await import(aircraftUrl);
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

test("flight metadata requires an exact callsign record and does not invent flight numbers", async () => {
  const routeUrl = await moduleUrl("../app/api/flight-number/route.ts");
  const realFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => {
      const callsign = String(url).split("/").at(-1);
      if (String(url).includes("/airline/"))
        return Response.json({
          response: [{ icao: "SHT", name: "British Airways Shuttle" }],
        });
      if (["SHT8R", "CFL06"].includes(callsign))
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
    ]) {
      const result = await (
        await GET(
          new Request(
            `http://localhost/api/flight-number?callsign=${callsign}`,
          ),
        )
      ).json();
      assert.deepEqual(result.flight, {
        number,
        airline,
        origin: null,
        destination: null,
      });
    }
    for (const callsign of ["SHT8R"]) {
      const result = await (
        await GET(
          new Request(
            `http://localhost/api/flight-number?callsign=${callsign}`,
          ),
        )
      ).json();
      assert.equal(result.flight, null);
    }
  } finally {
    globalThis.fetch = realFetch;
  }
});

const { locationPermission, requestLocation } = await import(
  await moduleUrl("../lib/location.ts")
);

test("permission discovery falls back when a WebView never settles or throws", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const pending = locationPermission({ query: () => new Promise(() => {}) });
  t.mock.timers.tick(1000);
  assert.equal(await pending, null);
  assert.equal(
    await locationPermission({
      query: () => {
        throw new Error("unsupported");
      },
    }),
    null,
  );
  assert.equal(await locationPermission(undefined), null);
  assert.equal(
    await locationPermission({ query: async () => ({ state: "granted" }) }),
    "granted",
  );
});

test("location has an independent deadline and ignores callbacks after timing out", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let lateSuccess;
  let lateFailure;
  const successes = [];
  const failures = [];
  requestLocation(
    {
      getCurrentPosition(success, failure, options) {
        lateSuccess = success;
        lateFailure = failure;
        assert.equal(options.enableHighAccuracy, false);
      },
    },
    (p) => successes.push(p),
    (e) => failures.push(e),
  );
  t.mock.timers.tick(20000);
  assert.deepEqual(failures, ["timeout"]);
  lateSuccess({ coords: { latitude: 51.47, longitude: -0.26 } });
  lateFailure({ code: 1 });
  assert.deepEqual(successes, []);
  assert.deepEqual(failures, ["timeout"]);
});

test("a cancelled location attempt cannot overwrite a successful retry", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const callbacks = [];
  const geo = {
    getCurrentPosition(success) {
      callbacks.push(success);
    },
  };
  const results = [];
  const failures = [];
  const cancel = requestLocation(
    geo,
    (p) => results.push(p),
    (e) => failures.push(e),
  );
  cancel();
  requestLocation(
    geo,
    (p) => results.push(p),
    (e) => failures.push(e),
  );
  const position = { coords: { latitude: 51.47, longitude: -0.26 } };
  callbacks[1](position);
  callbacks[0]({ coords: { latitude: 0, longitude: 0 } });
  t.mock.timers.tick(20000);
  assert.deepEqual(results, [position]);
  assert.deepEqual(failures, []);
});

test("location failures distinguish denial, missing APIs, and synchronous WebView errors", () => {
  const failures = [];
  const success = () => assert.fail("Unexpected location");
  const fail = (e) => failures.push(e);
  requestLocation(undefined, success, fail);
  requestLocation(
    {
      getCurrentPosition() {
        throw new Error("WebView failure");
      },
    },
    success,
    fail,
  );
  requestLocation(
    {
      getCurrentPosition(_success, failure) {
        failure({ code: 1 });
      },
    },
    success,
    fail,
  );
  assert.deepEqual(failures, ["unsupported", "unavailable", "denied"]);
});

test("CFL06 cannot inherit Swedish Airlines from its three-letter prefix", async () => {
  const realFetch = globalThis.fetch;
  const requests = [];
  try {
    globalThis.fetch = async (url) => {
      requests.push(String(url));
      if (String(url).includes("/airline/CFL"))
        return Response.json({
          response: [{ icao: "CFL", name: "Swedish Airlines" }],
        });
      return Response.json({ response: "unknown callsign" }, { status: 404 });
    };
    const { GET } = await import(
      await moduleUrl("../app/api/flight-number/route.ts")
    );
    const response = await GET(
      new Request("http://localhost/api/flight-number?callsign=CFL06"),
    );
    assert.deepEqual(await response.json(), { flight: null });
    assert.deepEqual(requests, ["https://api.adsbdb.com/v0/callsign/CFL06"]);
    globalThis.fetch = async () => {
      throw new Error("timeout");
    };
    const unavailable = await GET(
      new Request("http://localhost/api/flight-number?callsign=CFL07"),
    );
    assert.deepEqual(await unavailable.json(), { flight: null });
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("reported emitter categories distinguish rotorcraft and planes without guessing unknowns", () => {
  assert.equal(aircraftKind("A7"), "rotorcraft");
  for (const category of ["A1", "A2", "A3", "A4", "A5", "A6"])
    assert.equal(aircraftKind(category), "plane");
  for (const category of [undefined, null, "A0", "B1", "B2", "C1", "A8", 7])
    assert.equal(aircraftKind(category), "unknown");
  const cfl06 = nearestAircraft(
    [
      {
        hex: "c83353",
        flight: "CFL06   ",
        category: "A7",
        alt_baro: 450,
        lat: -40.338821,
        lon: 175.63147,
        seen_pos: 0.337,
      },
    ],
    -40.34,
    175.63,
  );
  assert.equal(cfl06.kind, "rotorcraft");
  assert.equal(cfl06.callsign, "CFL06");
});

const { locationAvailability } = await import(
  await moduleUrl("../lib/location.ts")
);
const locationEnvironment = {
  secureContext: true,
  geolocation: {
    getCurrentPosition() {
      assert.fail("Preflight must never request a position");
    },
  },
  permissions: { query: async () => ({ state: "prompt" }) },
};

test("location preflight detects missing APIs, insecure pages, and policy restrictions without prompting", async () => {
  assert.deepEqual(
    await locationAvailability({
      ...locationEnvironment,
      geolocation: undefined,
    }),
    { status: "unavailable", reason: "missing" },
  );
  assert.deepEqual(
    await locationAvailability({
      ...locationEnvironment,
      secureContext: false,
    }),
    { status: "unavailable", reason: "insecure" },
  );
  assert.deepEqual(
    await locationAvailability({
      ...locationEnvironment,
      policy: { allowsFeature: () => false },
    }),
    { status: "unavailable", reason: "policy" },
  );
  assert.deepEqual(
    await locationAvailability({
      ...locationEnvironment,
      permissions: { query: async () => ({ state: "denied" }) },
    }),
    { status: "denied" },
  );
});

test("preflight permits prompts and granted access using capabilities alone", async () => {
  assert.deepEqual(await locationAvailability(locationEnvironment), {
    status: "available",
    permission: "prompt",
  });
  assert.deepEqual(
    await locationAvailability({
      ...locationEnvironment,
      permissions: { query: async () => ({ state: "granted" }) },
    }),
    { status: "available", permission: "granted" },
  );
});

test("preflight stays usable when permission queries hang or policy inspection throws", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const pending = locationAvailability({
    ...locationEnvironment,
    permissions: { query: () => new Promise(() => {}) },
    policy: {
      allowsFeature() {
        throw new Error("WebView policy error");
      },
    },
  });
  t.mock.timers.tick(1000);
  assert.deepEqual(await pending, { status: "available", permission: null });
  assert.deepEqual(
    await locationAvailability({
      ...locationEnvironment,
      permissions: undefined,
    }),
    { status: "available", permission: null },
  );
});

test("flight routes preserve available airports, handle partial records, and require an exact callsign", async () => {
  const realFetch = globalThis.fetch;
  const origin = {
    name: " Tokyo Haneda Airport ",
    municipality: " Tokyo ",
    iata_code: " hnd ",
    icao_code: "RJTT",
  };
  const destination = {
    name: "London Heathrow Airport",
    municipality: "London",
    iata_code: "LHR",
    icao_code: "EGLL",
  };
  try {
    globalThis.fetch = async (url) => {
      const callsign = String(url).split("/").at(-1);
      const both = {
        callsign_icao: callsign,
        callsign_iata: `NH${callsign.slice(3)}`,
        airline: { name: "All Nippon Airways" },
        origin,
        destination,
      };
      const examples = {
        ANA211: both,
        ANA212: { ...both, origin: null },
        ANA213: {
          callsign_icao: callsign,
          origin: { name: " ", iata_code: 123 },
          destination: "invalid",
        },
        ANA214: { ...both, callsign_icao: "ANA999" },
        ANA215: {
          ...both,
          origin: {
            name: "Remote Airstrip",
            iata_code: "not a code",
            icao_code: "nzxx",
          },
          destination: null,
        },
      };
      return Response.json({ response: { flightroute: examples[callsign] } });
    };
    const { GET } = await import(
      await moduleUrl("../app/api/flight-number/route.ts")
    );
    const get = async (callsign) =>
      (
        await (
          await GET(
            new Request(
              `http://localhost/api/flight-number?callsign=${callsign}`,
            ),
          )
        ).json()
      ).flight;
    assert.deepEqual(await get("ANA211"), {
      number: "NH211",
      airline: "All Nippon Airways",
      origin: { name: "Tokyo Haneda Airport", city: "Tokyo", code: "HND" },
      destination: {
        name: "London Heathrow Airport",
        city: "London",
        code: "LHR",
      },
    });
    assert.deepEqual(await get("ANA212"), {
      number: "NH212",
      airline: "All Nippon Airways",
      origin: null,
      destination: {
        name: "London Heathrow Airport",
        city: "London",
        code: "LHR",
      },
    });
    assert.equal(await get("ANA213"), null);
    assert.equal(await get("ANA214"), null);
    assert.deepEqual((await get("ANA215")).origin, {
      name: "Remote Airstrip",
      city: null,
      code: "NZXX",
    });
  } finally {
    globalThis.fetch = realFetch;
  }
});
