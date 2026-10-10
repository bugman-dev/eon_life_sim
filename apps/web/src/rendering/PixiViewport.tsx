import { useEffect, useRef, useState } from "react";

export function PixiViewport() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState("Starting renderer");

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
          width: 640,
          height: 200,
          background: "#e7f5ef",
        });
        if (cancelled) {
          application.destroy();
          return;
        }
        host.appendChild(application.canvas);
        destroy = () => {
          application.destroy();
        };
        setMessage("Renderer ready. The world is not generated in this phase.");
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Renderer failed to start.");
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
    <section>
      <h2>World view</h2>
      <p>{message}</p>
      <div ref={hostRef} />
    </section>
  );
}
