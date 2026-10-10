import { useEffect, useRef, useState } from "react";

export function PixiViewport() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    let cancelled = false;
    let destroy: (() => void) | undefined;

    void (async () => {
      try {
        const { Application } = await import("pixi.js");
        const application = new Application();
        await application.init({
          resizeTo: host,
          background: "#d7efc8",
        });
        if (cancelled) {
          application.destroy();
          return;
        }
        host.appendChild(application.canvas);
        destroy = () => {
          application.destroy();
        };
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Renderer failed to start.");
        }
      }
    })();

    return () => {
      cancelled = true;
      destroy?.();
      host.replaceChildren();
    };
  }, []);

  return (
    <section className="eon-viewport" aria-label="World view">
      <div ref={hostRef} className="eon-viewport-canvas" />
      {error ? <p className="eon-viewport-status">{error}</p> : null}
    </section>
  );
}
