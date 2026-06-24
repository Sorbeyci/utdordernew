import { useEffect, useRef, useState } from "react";
import { CameraOff } from "lucide-react";
import { Modal, Button } from "@/components/ui";

/**
 * Optional camera barcode scanner. Uses the native BarcodeDetector API
 * (Chrome/Android) when available; otherwise tells the user to use the
 * handheld scanner. Progressive enhancement — never blocks the flow.
 */
export function CameraScanner({
  open,
  onClose,
  onDetected,
}: {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const supported =
    typeof window !== "undefined" && "BarcodeDetector" in window;

  useEffect(() => {
    if (!open || !supported) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detector = new (window as any).BarcodeDetector({
      formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39"],
    });

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const tick = async () => {
          if (stopped || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0 && codes[0].rawValue) {
              onDetected(codes[0].rawValue);
              return; // stop on first hit
            }
          } catch {
            /* frame not ready */
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        setError("Couldn't access the camera. Check permissions.");
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open, supported, onDetected]);

  return (
    <Modal open={open} onClose={onClose} title="Scan barcode" size="sm">
      {!supported ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center text-ink-500">
          <CameraOff size={28} />
          <p className="text-sm">
            Camera scanning isn't supported on this browser. Use a handheld scanner —
            the barcode field adds the product automatically on Enter.
          </p>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      ) : error ? (
        <div className="py-6 text-center text-sm text-red-600">{error}</div>
      ) : (
        <div className="overflow-hidden rounded-lg bg-black">
          <video ref={videoRef} className="h-64 w-full object-cover" muted playsInline />
        </div>
      )}
    </Modal>
  );
}
