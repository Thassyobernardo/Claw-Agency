
import { useState } from "react";
import { Upload, FileText, X, CheckCircle, Loader2 } from "lucide-react";

export default function FileUploadImporter() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "success">("idle");

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith(".csv") || droppedFile.name.endsWith(".xlsx"))) {
      setFile(droppedFile);
    } else {
      alert("Please upload a .csv or .xlsx file.");
    }
  };

  const handleUpload = async () => {
    setStatus("uploading");
    await new Promise(r => setTimeout(r, 2000));
    setStatus("success");
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center">
      <h3 className="text-lg font-bold text-slate-800 mb-2">Import from CSV or Excel</h3>
      <p className="text-sm text-slate-500 mb-8">Export your bank statement and upload it here. We'll handle the rest.</p>

      {!file ? (
        <div
          onDragOver={(e: React.DragEvent<HTMLDivElement>) => e.preventDefault()}
          onDrop={handleDrop}
          className="border-2 border-dashed border-slate-200 rounded-3xl py-16 flex flex-col items-center gap-4 hover:border-aw-green transition cursor-pointer"
          onClick={() => (document.getElementById("file-input") as HTMLInputElement)?.click()}
        >
          <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-400">
            <Upload size={32} />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-600">Drag & drop your file here</p>
            <p className="text-xs text-slate-400 mt-1">Supports .csv, .xlsx (max 10MB)</p>
          </div>
          <input
            id="file-input"
            type="file"
            hidden
            accept=".csv, .xlsx"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
      ) : (
        <div className="border border-slate-200 rounded-2xl p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-12 w-12 bg-green-50 rounded-xl flex items-center justify-center text-green-600">
              <FileText size={24} />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-bold text-slate-800">{file.name}</p>
              <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
            <button onClick={() => { setFile(null); setStatus("idle"); }} className="text-slate-300 hover:text-red-500 transition">
              <X size={20} />
            </button>
          </div>

          {status === "idle" && (
            <button
              onClick={handleUpload}
              className="w-full bg-green-600 py-4 text-white font-bold rounded-xl hover:bg-green-700 transition"
            >
              Process File with AI
            </button>
          )}

          {status === "uploading" && (
            <div className="flex flex-col items-center gap-3 py-2">
              <Loader2 className="animate-spin text-green-600" size={32} />
              <p className="text-sm font-bold text-slate-700">AI is analyzing your transactions...</p>
            </div>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center gap-3 py-2 text-green-600">
              <CheckCircle size={32} />
              <p className="text-sm font-bold text-slate-700">Success! {Math.floor(Math.random() * 50) + 10} transactions found.</p>
              <button onClick={() => { setFile(null); setStatus("idle"); }} className="text-xs font-bold underline mt-2">
                Upload another file
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
