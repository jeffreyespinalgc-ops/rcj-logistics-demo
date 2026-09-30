import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Eraser, Save } from 'lucide-react';

const INK = '#111827';
const LINE_WIDTH = 2.4;
/** Ancho maximo de la imagen guardada: la firma se ve nitida en el PDF y pesa poco en el almacenamiento local */
const EXPORT_MAX_WIDTH = 520;

interface Point { x: number; y: number }

/**
 * Lienzo para firmar con el mouse, el dedo o un lapiz. Limpiar borra el trazo; Guardar entrega la firma como PNG
 * transparente, recortada al trazo. No tiene boton de cancelar: quien lo usa decide como cerrarlo.
 */
export function SignaturePad({ onSave, saveLabel = 'Guardar' }: { onSave: (dataUrl: string) => void; saveLabel?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<Point | null>(null);
  const lastMid = useRef<Point | null>(null);
  const bounds = useRef({ minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
  const [hasInk, setHasInk] = useState(false);

  // la resolucion interna sigue al tamano real en pantalla (y a la densidad del monitor) para que el trazo no se vea borroso
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = INK;
      ctx.lineWidth = LINE_WIDTH * ratio;
    }
  }, []);

  const pointFrom = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const grow = (p: Point) => {
    const b = bounds.current;
    b.minX = Math.min(b.minX, p.x);
    b.minY = Math.min(b.minY, p.y);
    b.maxX = Math.max(b.maxX, p.x);
    b.maxY = Math.max(b.maxY, p.y);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = pointFrom(e);
    last.current = p;
    lastMid.current = p;
    grow(p);
    // un toque suelto deja un punto
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fillStyle = INK;
      ctx.fill();
    }
    setHasInk(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    const from = last.current;
    const start = lastMid.current;
    if (!ctx || !from || !start) return;
    const to = pointFrom(e);
    // curva suave: cada tramo va del punto medio anterior al siguiente, usando el punto tocado como control
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.quadraticCurveTo(from.x, from.y, mid.x, mid.y);
    ctx.stroke();
    last.current = to;
    lastMid.current = mid;
    grow(to);
  };

  const endStroke = () => {
    drawing.current = false;
    last.current = null;
    lastMid.current = null;
  };

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    bounds.current = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    setHasInk(false);
  }, []);

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasInk) return;
    const b = bounds.current;
    const pad = 8 * (window.devicePixelRatio || 1);
    const sx = Math.max(0, Math.floor(b.minX - pad));
    const sy = Math.max(0, Math.floor(b.minY - pad));
    const sw = Math.min(canvas.width - sx, Math.ceil(b.maxX - b.minX + pad * 2));
    const sh = Math.min(canvas.height - sy, Math.ceil(b.maxY - b.minY + pad * 2));
    const scale = Math.min(1, EXPORT_MAX_WIDTH / sw);
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(sw * scale));
    out.height = Math.max(1, Math.round(sh * scale));
    out.getContext('2d')?.drawImage(canvas, sx, sy, sw, sh, 0, 0, out.width, out.height);
    onSave(out.toDataURL('image/png'));
  };

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-md border border-stone-300 bg-white">
        <canvas
          ref={canvasRef}
          aria-label="Recuadro para firmar"
          className="block h-64 w-full cursor-crosshair touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke} 
        />
        {/* linea guia: no forma parte de la firma que se guarda */}
        <div className="pointer-events-none absolute inset-x-6 bottom-9 border-t border-dashed border-stone-300" />
        {!hasInk && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-content text-stone-300">
            Firma aqui
          </p>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" className="min-h-[44px]" onClick={clear} disabled={!hasInk}>
          <Eraser size={16} />
        </Button>
        <Button type="button" className="min-h-[44px]" onClick={save} disabled={!hasInk}>
          <Save size={16} /> {saveLabel}
        </Button>
      </div>
    </div>
  );
}
