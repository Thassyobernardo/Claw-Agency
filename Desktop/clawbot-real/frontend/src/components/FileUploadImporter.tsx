
import { useState } from "react";
import { Upload, FileText, X, CheckCircle, Loader2, Sparkles, ArrowRight, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";

type Status = "idle" | "uploading" | "success" | "classifying" | "error";

interface ImportResult {
  inserted: number;
  skipped: number;
  total: number;
}

export default function FileUploadImporter() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith(".csv") || droppedFile.name.endsWith(".xlsx"))) {
      setFile(droppedFile);
      setStatus("idle");
      setError(null);
    } else {
      setError("Please upload a .csv or .xlsx file.");
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setStatus("uploading");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/import/csv", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Upload failed. Please try again.");
        setStatus("error");
        return;
      }

      setResult({ inserted: data.inserted, skipped: data.skipped, total: data.total });
      setStatus("success");
    } catch {
      setError("Network error. Please check your connection and try again.");
      setStatus("error");
    }
  };

  const handleClassifyAndGo = async () => {
    setStatus("classifying");
    try {
      await fetch("/api/transactions/classify", { method: "POST" });
    } catch {
      // Even if classify fails, still navigate — user can classify from dashboard
    }
    router.push("/dashboard");
  };

  const reset = () => {
    setFile(null);
    setStatus("idle");
    setResult(null);
    setError(null);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center">
      <h3 className="text-lg font-bold text-slate-800 mb-2">Import from CSV</h3>
      <p className="text-sm text-slate-500 mb-8">Export your bank statement and upload it here. Our AI will classify every transaction.</p>

      {/* File picker */}
      {!file && (
        <div
          onDragOver={(e: React.DragEvent<HTMLDivElement>) => e.preventDefault()}
          onDrop={handleDrop}
          className="border-2 border-dashed border-slate-200 rounded-3xl py-16 flex flex-col items-center gap-4 hover:border-green-400 transition cursor-pointer"
          onClick={() => (document.getElementById("file-input") as HTMLInputElement)?.click()}
        >
          <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 hover:text-green-600 transition">
            <Upload size={32} />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-600">Drag & drop your CSV file here</p>
            <p className="text-xs text-slate-400 mt-1">Supports .csv files · max 10 MB</p>
            <p className="text-xs text-slate-400 mt-1">Columns: date, description, amount (any order)</p>
          </div>
          <input
            id="file-input"
            type="file"
            hidden
            accept=".csv"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              setError(null);
              setStatus("idle");
            }}
          />
        </div>
      )}

      {/* File selected — ready to upload */}
      {file && status === "idle" && (
        <div className="border border-slate-200 rounded-2xl p-6 text-left">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-12 w-12 bg-green-50 rounded-xl flex items-center justify-center text-green-600 shrink-0">
              <FileText size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-800 truncate">{file.name}</p>
              <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
            <button onClick={reset} className="text-slate-300 hover:text-red-500 transition shrink-0">
              <X size={20} />
            </button>
          </div>
          <button
            onClick={handleUpload}
            className="w-full bg-blue-600 py-4 text-white font-bold rounded-xl hover:bg-blue-700 transition flex items-center justify-center gap-2"
          >
            <Upload size={18} /> Upload & Import Transactions
          </button>
        </div>
      )}

      {/* Uploading */}
      {status === "uploading" && (
        <div className="flex flex-col items-center gap-4 py-8">
          <Loader2 className="animate-spin text-blue-600" size={40} />
          <p className="text-sm font-bold text-slate-700">Uploading and parsing your file...</p>
          <p className="text-xs text-slate-400">This may take a few seconds</p>
        </div>
      )}

      {/* Success */}
      {status === "success" && result && (
        <div className="flex flex-col items-center gap-5 py-4">
          <div className="h-16 w-16 bg-green-50 rounded-full flex items-center justify-center text-green-600">
            <CheckCircle size={40} />
          </div>
          <div>
            <p className="text-lg font-black text-slate-800">
              {result.inserted} transactions imported!
            </p>
            <p className="text-sm text-slate-500 mt-1">
              {result.skipped > 0 ? `${result.skipped} rows skipped (missing data) · ` : ""}
              Ready for AI classification
            </p>
          </div>
          <button
            onClick={handleClassifyAndGo}
            className="w-full max-w-sm bg-green-600 py-4 text-white font-bold rounded-xl hover:bg-green-700 transition flex items-center justify-center gap-2 shadow-lg shadow-green-600/20"
          >
            <Sparkles size={18} /> Classify with AI & Go to Dashboard
            <ArrowRight size={16} />
          </button>
          <button onClick={reset} className="text-xs text-slate-400 hover:text-slate-600 underline">
            Upload another file
          </button>
        </div>
      )}

      {/* Classifying */}
      {status === "classifying" && (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="relative">
            <Loader2 className="animate-spin text-green-600" size={40} />
            <Sparkles className="absolute -top-1 -right-1 text-green-400" size={16} />
          </div>
          <p className="text-sm font-bold text-slate-700">AI is classifying your transactions...</p>
          <p className="text-xs text-slate-400">Redirecting to dashboard shortly</p>
        </div>
      )}

      {/* Error */}
      {status === "error" && (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="h-14 w-14 bg-red-50 rounded-full flex items-center justify-center text-red-500">
            <AlertCircle size={32} />
          </div>
          <p className="text-sm font-bold text-red-600">{error}</p>
          <button
            onClick={reset}
            className="bg-slate-100 text-slate-700 font-bold py-3 px-8 rounded-xl hover:bg-slate-200 transition"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
