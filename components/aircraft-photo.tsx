"use client";
import { useEffect, useId, useRef, useState } from "react";
type Photo = { src: string; link: string; photographer: string };
export default function AircraftPhoto({
  hex,
  registration,
  type,
}: {
  hex: string;
  registration: string | null;
  type: string | null;
}) {
  const [result, setResult] = useState<{
    hex: string;
    photo: Photo | null;
  } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    dialog.current?.close();
    setOpened(false);
    const controller = new AbortController();
    fetch(`/api/aircraft-photo?hex=${encodeURIComponent(hex)}`, {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : { photo: null }))
      .then((data) => {
        if (!controller.signal.aborted)
          setResult({ hex, photo: (data as { photo: Photo | null }).photo });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ hex, photo: null });
      });
    return () => controller.abort();
  }, [hex]);
  const photo = result?.hex === hex ? result.photo : null;
  if (!photo || failed === photo.src) return null;
  return (
    <>
      <button
        className="aircraft-photo-trigger"
        onClick={() => {
          setOpened(true);
          dialog.current?.showModal();
        }}
      >
        See aircraft photo <span aria-hidden="true">⤢</span>
      </button>
      <dialog
        ref={dialog}
        className="aircraft-lightbox"
        aria-labelledby={titleId}
        onClose={() => setOpened(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
      >
        <div className="lightbox-content">
          <div className="lightbox-heading">
            <div>
              <span className="board-label">AIRCRAFT PHOTO</span>
              <h2 id={titleId}>
                {registration || hex.toUpperCase()}
                {type && <span>{type}</span>}
              </h2>
            </div>
            <button
              className="lightbox-close"
              onClick={() => dialog.current?.close()}
              aria-label="Close aircraft photo"
              autoFocus
            >
              <svg
                viewBox="0 0 20 20"
                width="16"
                height="16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="m5 5 10 10M15 5 5 15"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
          {opened && (
            <a
              href={photo.link}
              target="_blank"
              rel="noreferrer"
              aria-label="View original photo on Planespotters.net"
            >
              <img
                className="lightbox-image"
                src={photo.src}
                alt={`${registration || hex}${type ? ` (${type})` : ""} aircraft photograph`}
                onError={() => setFailed(photo.src)}
              />
            </a>
          )}
          <div className="lightbox-caption">
            <a href={photo.link} target="_blank" rel="noreferrer">
              © {photo.photographer} / Planespotters.net ↗
            </a>
            <p>Photo may show an earlier livery.</p>
          </div>
        </div>
      </dialog>
    </>
  );
}
