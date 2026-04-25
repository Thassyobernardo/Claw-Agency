
"use client";

import { useState } from "react";
import { Mail, Send, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export default function TestEmailPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | success | error
  const [message, setMessage] = useState("");

  const handleSendTest = async () => {
    setStatus("sending");
    try {
      const response = await fetch("/api/admin/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      if (response.ok) {
        setStatus("success");
        setMessage("Email sent successfully! Check your inbox.");
      } else {
        setStatus("error");
        setMessage(data.error || "Failed to send email.");
      }
    } catch (error) {
      setStatus("error");
      setMessage("Network error. Please check your connection.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-slate-200">
        <div className="h-16 w-16 bg-aw-green/10 rounded-2xl flex items-center justify-center text-aw-green mb-6">
          <Mail size={32} />
        </div>
        <h1 className="text-2xl font-black text-slate-900 mb-2">Email Delivery Test</h1>
        <p className="text-slate-500 text-sm mb-8">
          Verify if your Resend integration is working. Enter an email to receive a welcome sample.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Target Email</label>
            <input 
              type="email" 
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-aw-green transition"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <button 
            onClick={handleSendTest}
            disabled={status === "sending" || !email}
            className="w-full bg-aw-green py-4 text-white font-bold rounded-xl shadow-lg shadow-aw-green/20 hover:bg-aw-green-dark transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {status === "sending" ? <Loader2 className="animate-spin" /> : <Send size={18} />}
            Send Test Email
          </button>

          {status === "success" && (
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-100 rounded-xl text-green-700 text-sm">
              <CheckCircle2 size={18} /> {message}
            </div>
          )}

          {status === "error" && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm">
              <AlertCircle size={18} /> {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
