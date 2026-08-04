import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ExportHandler = () => Promise<void>;

type KpiExportContextValue = {
  registerExporter: (handler: ExportHandler | null) => void;
  exportPdf: () => Promise<void>;
  exporting: boolean;
};

const KpiExportContext = createContext<KpiExportContextValue | null>(null);

export function KpiExportProvider({ children }: { children: ReactNode }) {
  const handlerRef = useRef<ExportHandler | null>(null);
  const [exporting, setExporting] = useState(false);

  const registerExporter = useCallback((handler: ExportHandler | null) => {
    handlerRef.current = handler;
  }, []);

  const exportPdf = useCallback(async () => {
    if (!handlerRef.current) {
      throw new Error("Nothing available to export on this tab.");
    }
    setExporting(true);
    try {
      await handlerRef.current();
    } finally {
      setExporting(false);
    }
  }, []);

  return (
    <KpiExportContext.Provider value={{ registerExporter, exportPdf, exporting }}>
      {children}
    </KpiExportContext.Provider>
  );
}

export function useKpiExport() {
  const ctx = useContext(KpiExportContext);
  if (!ctx) {
    throw new Error("useKpiExport must be used within KpiExportProvider");
  }
  return ctx;
}

export function useRegisterKpiExporter(handler: ExportHandler | null) {
  const { registerExporter } = useKpiExport();

  useEffect(() => {
    registerExporter(handler);
    return () => registerExporter(null);
  }, [handler, registerExporter]);
}
