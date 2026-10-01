import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { FileDown } from 'lucide-react';
import { renderPdfPages, type BuiltPdf } from '@/lib/pdfShared';

type Preview =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; built: BuiltPdf; pages: string[] };

/**
 * Vista previa generica de un documento PDF: lo genera, lo rasteriza a imagenes (pdf.js) para que se vea
 * igual en telefono y en navegadores con el visor de PDF desactivado, y ofrece descargarlo si corresponde.
 */
export function DocumentPreview({ buildDoc, documentKey, altPrefix, canDownload, onBack, backLabel }: {
  buildDoc: () => Promise<BuiltPdf | null>;
  /** cambia solo cuando el documento mostrado realmente cambia, para no regenerar en cada actualizacion */
  documentKey: string;
  altPrefix: string;
  canDownload: boolean;
  onBack: () => void;
  backLabel: string;
}) {
  const [preview, setPreview] = useState<Preview>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const buildRef = useRef(buildDoc);
  buildRef.current = buildDoc;

  useEffect(() => {
    let cancelled = false;
    setPreview({ status: 'loading' });
    (async () => {
      try {
        const built = await buildRef.current();
        if (!built) throw new Error('sin datos suficientes');
        const pages = await renderPdfPages(built.doc);
        if (!cancelled) setPreview({ status: 'ready', built, pages });
      } catch {
        if (!cancelled) setPreview({ status: 'error' });
      }
    })();
    return () => { cancelled = true; };
  }, [documentKey, attempt]);

  return (
    <div className="space-y-4">
      <div className="max-h-[65dvh] space-y-3 overflow-auto rounded-md border border-stone-200 bg-stone-100 p-2 sm:p-3">
        {preview.status === 'loading' && (
          <p role="status" className="py-16 text-center text-content text-stone-500">Generando documento...</p>
        )}
        {preview.status === 'error' && (
          <div className="space-y-3 py-12 text-center">
            <p role="alert" className="text-content text-red-700">No se pudo generar el documento.</p>
            <Button variant="outline" className="min-h-[44px]" onClick={() => setAttempt(a => a + 1)}>Reintentar</Button>
          </div>
        )}
        {preview.status === 'ready' && preview.pages.map((src, i) => (
          <img
            key={i}
            src={src}
            alt={`${altPrefix}, hoja ${i + 1} de ${preview.pages.length}`}
            className="h-auto w-full rounded bg-white shadow-card"
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {!canDownload && preview.status === 'ready' && (
          <span className="mr-auto text-content text-stone-500"></span>
        )}
        <Button variant="outline" className="min-h-[44px]" onClick={onBack}>{backLabel}</Button>
        {canDownload && (
          <Button
            className="min-h-[44px]"
            disabled={preview.status !== 'ready'}
            onClick={() => { if (preview.status === 'ready') preview.built.doc.save(preview.built.filename); }}
          >
            <FileDown size={14} />
          </Button>
        )}
      </div>
    </div>
  );
}
