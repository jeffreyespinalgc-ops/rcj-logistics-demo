import { useRef, useState } from 'react';
import { Button } from './Button';
import { Camera, ChevronLeft, ChevronRight, ImageIcon, Plus, X } from 'lucide-react';
import type { AssetPhoto } from '@/types';

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/**
 * Galeria de fotos en carrusel con swipe (arrastrar/tocar para navegar, puntos, vista ampliada) -- el mismo
 * componente que usa la ficha de un activo, ahora reusable: quien lo usa decide de donde vienen las fotos y
 * que hacer al agregar/quitar una (persistirlas de una, o solo juntarlas local hasta que exista el registro
 * al que pertenecen, como en "Nueva OT" antes de crear la OT).
 */
export function PhotoCarousel({ photos, canEdit, busy = false, onAddFiles, onRemove, emptyEditableLabel, emptyReadonlyLabel, compact = false }: {
  photos: AssetPhoto[];
  canEdit: boolean;
  busy?: boolean;
  onAddFiles: (files: FileList | null) => void;
  onRemove: (photo: AssetPhoto) => void;
  emptyEditableLabel?: string;
  emptyReadonlyLabel?: string;
  /** Carrusel mas chico (p. ej. el de la vista de la OT, donde sobra espacio) */
  compact?: boolean;
}) {
  const [preview, setPreview] = useState<AssetPhoto | null>(null);
  const [index, setIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartX = useRef(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  // la mas reciente primero
  const ordered = [...photos].reverse();
  const safeIndex = Math.min(index, Math.max(0, ordered.length - 1));
  const current = ordered[safeIndex] ?? null;

  const goPrev = () => setIndex(i => Math.max(0, Math.min(i, ordered.length - 1) - 1));
  const goNext = () => setIndex(i => Math.min(ordered.length - 1, Math.min(i, ordered.length - 1) + 1));

  const onDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    dragStartX.current = e.clientX;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragOffset(e.clientX - dragStartX.current);
  };

  const onDragEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    // un toque sin arrastrar abre la foto en grande (solo en pointerup; cancelar el gesto no abre nada)
    if (e.type === 'pointerup' && Math.abs(dragOffset) <= 5 && current) setPreview(current);
    const threshold = Math.min(60, (viewportRef.current?.clientWidth ?? 240) * 0.2);
    if (dragOffset < -threshold) goNext();
    else if (dragOffset > threshold) goPrev();
    setDragging(false);
    setDragOffset(0);
  };

  const handleFiles = (files: FileList | null) => {
    onAddFiles(files);
    setIndex(0); // la nueva foto queda primera (mas reciente): se muestra de una vez
    if (fileRef.current) fileRef.current.value = '';
    if (cameraRef.current) cameraRef.current.value = '';
  };

  return (
    <div className="rounded-md border border-stone-200 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {canEdit && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => cameraRef.current?.click()} disabled={busy}>
              <Camera size={14} /> Tomar foto
            </Button>
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
              <Plus size={14} /> {busy ? 'Cargando...' : ''} Subir archivo
            </Button>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleFiles(e.target.files)} />
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
          </div>
        )}
      </div>

      {current ? (
        <div className={`mx-auto flex flex-col gap-2 ${compact ? 'max-w-[15rem]' : 'max-w-sm'}`}>
          <div className="relative">
            <div
              ref={viewportRef}
              onPointerDown={onDragStart}
              onPointerMove={onDragMove}
              onPointerUp={onDragEnd}
              onPointerCancel={onDragEnd}
              className="aspect-[4/3] w-full touch-pan-y select-none overflow-hidden rounded-md border border-stone-300 bg-stone-100 cursor-pointer"
            >
              <div
                className="flex h-full"
                style={{
                  width: `${ordered.length * 100}%`,
                  transform: `translateX(calc(${-safeIndex * (100 / ordered.length)}% + ${dragOffset}px))`,
                  transition: dragging ? 'none' : 'transform 300ms ease-out',
                }}
              >
                {ordered.map(photo => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => setPreview(photo)}
                    className="h-full flex-shrink-0 cursor-pointer"
                    style={{ width: `${100 / ordered.length}%` }}
                    title={`${photo.name} - ${formatDateTime(photo.addedAt)}`}
                  >
                    <img src={photo.dataUrl} alt={photo.name} draggable={false} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            {ordered.length > 1 && (
              <>
                <button
                  onClick={goPrev}
                  disabled={safeIndex === 0}
                  aria-label="Foto anterior"
                  className="absolute left-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-stone-700 shadow-card transition-opacity hover:bg-white disabled:pointer-events-none disabled:opacity-0"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={goNext}
                  disabled={safeIndex === ordered.length - 1}
                  aria-label="Foto siguiente"
                  className="absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-stone-700 shadow-card transition-opacity hover:bg-white disabled:pointer-events-none disabled:opacity-0"
                >
                  <ChevronRight size={18} />
                </button>
              </>
            )}

            {canEdit && (
              <button
                onClick={() => onRemove(current)}
                className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-sm transition-colors hover:bg-red-600"
                title="Eliminar fotografia"
                aria-label={`Eliminar ${current.name}`}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {ordered.length > 1 && (
            <div className="flex items-center justify-center gap-1.5">
              {ordered.map((photo, i) => (
                <button
                  key={photo.id}
                  onClick={() => setIndex(i)}
                  aria-label={`Ver foto ${i + 1} de ${ordered.length}`}
                  className={`h-1.5 rounded-full transition-all ${i === safeIndex ? 'w-5 bg-orange-500' : 'w-1.5 bg-stone-300 hover:bg-stone-400'}`}
                />
              ))}
            </div>
          )}

          <p className="text-center text-content text-stone-400">
            {formatDateTime(current.addedAt)}{ordered.length > 1 ? ` · ${safeIndex + 1}/${ordered.length}` : ''}
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-stone-200 py-6 text-center">
          <ImageIcon size={22} className="mx-auto mb-1 text-stone-300" />
          <p className="text-content text-stone-400">
            {canEdit ? (emptyEditableLabel ?? ' ') : (emptyReadonlyLabel ?? 'Sin fotografias registradas.')}
          </p>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-stone-900/70 backdrop-blur-sm" onClick={() => setPreview(null)} />
          <div className="relative flex max-h-[90vh] max-w-5xl flex-col">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-white">
                <p className="text-content font-medium">{preview.name}</p>
                <p className="text-content text-stone-300">{formatDateTime(preview.addedAt)}</p>
              </div>
              <button onClick={() => setPreview(null)} className="text-white/80 transition-colors hover:text-white">
                <X size={22} />
              </button>
            </div>
            <img src={preview.dataUrl} alt={preview.name} className="max-h-[80vh] rounded-lg bg-stone-900 object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}