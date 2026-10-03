import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { FileDown, Printer, X } from 'lucide-react';
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

  // imprime el PDF real (no las imagenes rasterizadas de la vista previa) en un iframe oculto: al cargar,
  // dispara el dialogo nativo de impresion del navegador; "afterprint" (se dispara al imprimir o al
  // cancelar) limpia el iframe y libera el blob
  const handlePrint = () => {
    if (preview.status !== 'ready') return;
    // los tipos de jsPDF declaran que "bloburl" devuelve un URL, pero en tiempo de ejecucion es el string
    // que devuelve URL.createObjectURL (se ve en su propio codigo fuente) -- .href rompe (queda "undefined")
    const blobUrl = preview.built.doc.output('bloburl') as unknown as string;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = blobUrl;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      const win = iframe.contentWindow;
      if (!win) return;
      win.focus();
      win.print();
      win.addEventListener('afterprint', () => {
        document.body.removeChild(iframe);
        URL.revokeObjectURL(blobUrl);
      });
    };
  };

  return (
    <div className="space-y-4">
      <div className="flex max-h-[75dvh] flex-col items-center space-y-3 overflow-auto rounded-md border border-stone-200 bg-stone-100 p-2 sm:p-3">
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
            className="h-auto max-h-[70dvh] w-auto max-w-full flex-shrink-0 rounded bg-white shadow-card"
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {!canDownload && preview.status === 'ready' && (
          <span className="mr-auto text-content text-stone-500"></span>
        )}
        <Button variant="outline" className="min-h-[44px]" onClick={onBack}><X size={12}/>{backLabel}</Button>
        {canDownload && (
          <Button
            className="min-h-[44px]"
            disabled={preview.status !== 'ready'}
            onClick={() => { if (preview.status === 'ready') preview.built.doc.save(preview.built.filename); }}
          >
            <FileDown size={14} /> Descargar
          </Button>
        )}
        {canDownload && (
          <Button variant="secondary" className="min-h-[44px]" disabled={preview.status !== 'ready'} onClick={handlePrint}>
            <Printer size={12} /> Imprimir
          </Button>
        )}
      </div>
    </div>
  );
}
