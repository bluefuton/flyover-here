export type LocationFailure =
  | "denied"
  | "timeout"
  | "unavailable"
  | "unsupported";

// Some embedded browsers expose Permissions but never settle the query.
export async function locationPermission(
  permissions: Pick<Permissions, "query"> | undefined,
  timeout = 1000,
): Promise<PermissionState | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      permissions
        ? permissions
            .query({ name: "geolocation" })
            .then((result) => result.state)
        : Promise.resolve(null),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeout);
      }),
    ]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// The browser's timeout excludes time spent asking for permission. Keep our own
// deadline so a stalled permission prompt or WebView callback cannot strand UI.
export function requestLocation(
  geolocation: Pick<Geolocation, "getCurrentPosition"> | undefined,
  success: (position: GeolocationPosition) => void,
  failure: (reason: LocationFailure) => void,
  timeout = 20000,
): () => void {
  let active = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => {
    active = false;
    clearTimeout(timer);
  };
  const fail = (reason: LocationFailure) => {
    if (!active) return;
    cancel();
    failure(reason);
  };
  if (!geolocation) {
    fail("unsupported");
    return cancel;
  }
  timer = setTimeout(() => fail("timeout"), timeout);
  try {
    geolocation.getCurrentPosition(
      (position) => {
        if (!active) return;
        cancel();
        success(position);
      },
      (error) =>
        fail(
          error.code === 1
            ? "denied"
            : error.code === 3
              ? "timeout"
              : "unavailable",
        ),
      // A city-scale fix is enough to start; the live watch refines it afterward.
      { enableHighAccuracy: false, maximumAge: 30000, timeout: 15000 },
    );
  } catch {
    fail("unavailable");
  }
  return cancel;
}
