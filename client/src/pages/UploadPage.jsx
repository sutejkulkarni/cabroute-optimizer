// src/pages/UploadPage.jsx
import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { uploadAndOptimize, getDefaults } from "../services/api";
import { useEffect } from "react";

const DEFAULT_CONFIG = {
  cab_capacity: 6,
  rate_per_km: 18,
  working_days: 26,
  office_lat: 12.9352,
  office_lng: 77.6245,
};

export default function UploadPage() {
  const navigate = useNavigate();
  const [file, setFile]       = useState(null);
  const [config, setConfig]   = useState(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [stage, setStage]     = useState(""); // geocoding / clustering / solving

  useEffect(() => {
    getDefaults().then(d => setConfig(c => ({ ...c, ...d }))).catch(() => {});
  }, []);

  const onDrop = useCallback((accepted) => {
    if (accepted[0]) { setFile(accepted[0]); setError(null); }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
              "application/vnd.ms-excel": [".xls"] },
    maxFiles: 1,
  });

  const handleSubmit = async () => {
    if (!file) return setError("Please upload an Excel file first.");
    setLoading(true); setError(null);

    const stages = ["Reading Excel & geocoding addresses...", "Clustering employees by area...", "Solving optimal routes with OR-Tools...", "Calculating costs..."];
    let si = 0;
    setStage(stages[si]);
    const interval = setInterval(() => {
      si = Math.min(si + 1, stages.length - 1);
      setStage(stages[si]);
    }, 18000);

    try {
      const result = await uploadAndOptimize(file, config);
      clearInterval(interval);
      navigate(`/results/${result.run_id}`, { state: result });
    } catch (err) {
      clearInterval(interval);
      setError(err.response?.data?.error || err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const Field = ({ label, field, step = 1, hint }) => (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-display font-semibold text-slate-400 uppercase tracking-widest">{label}</label>
      <input
        type="number" step={step}
        value={config[field]}
        onChange={e => setConfig(c => ({ ...c, [field]: parseFloat(e.target.value) }))}
        className="input-field"
      />
      {hint && <p className="text-xs text-slate-600">{hint}</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-dark-900 px-6 py-12 flex flex-col items-center">

      {/* Header */}
      <div className="w-full max-w-3xl mb-12 animate-fade-up">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center text-sm">🚌</div>
          <span className="font-display font-bold text-xl text-white tracking-tight">CabRoute</span>
          <span className="tag border-brand-800 text-brand-400 bg-brand-900/30 ml-auto">Optimizer</span>
        </div>
        <h1 className="font-display font-extrabold text-4xl text-white leading-tight mb-2">
          Optimize employee<br />
          <span className="text-brand-400">cab routes.</span>
        </h1>
        <p className="text-slate-400 font-body text-base">
          Upload your employee Excel sheet. Get optimized routes, cab count, and cost breakdown — powered by OR-Tools VRP.
        </p>
      </div>

      <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-5 gap-6">

        {/* Drop zone — 3 cols */}
        <div className="md:col-span-3 animate-fade-up-delay-1">
          <div
            {...getRootProps()}
            className={`card p-8 flex flex-col items-center justify-center gap-4 cursor-pointer min-h-[260px]
              border-2 border-dashed transition-all duration-200
              ${isDragActive ? "border-brand-500 bg-brand-900/20" : "border-dark-500 hover:border-brand-600"}`}
          >
            <input {...getInputProps()} />
            <div className="w-16 h-16 rounded-2xl bg-dark-700 flex items-center justify-center text-3xl">
              {file ? "✅" : "📊"}
            </div>
            {file ? (
              <>
                <p className="font-display font-semibold text-white text-center">{file.name}</p>
                <p className="text-xs text-slate-500 font-mono">{(file.size / 1024).toFixed(1)} KB</p>
                <button onClick={e => { e.stopPropagation(); setFile(null); }}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors">
                  Remove file
                </button>
              </>
            ) : (
              <>
                <p className="font-display font-semibold text-white text-center">
                  {isDragActive ? "Drop it here" : "Drag & drop your Excel file"}
                </p>
                <p className="text-xs text-slate-500 text-center">or click to browse · .xlsx or .xls only</p>
                <a href="/sample_template.xlsx"
                  onClick={e => e.stopPropagation()}
                  className="text-xs text-brand-400 hover:text-brand-300 underline underline-offset-2">
                  Download sample template ↓
                </a>
              </>
            )}
          </div>

          {/* Column guide */}
          <div className="mt-3 card p-4">
            <p className="text-xs font-display font-semibold text-slate-500 uppercase tracking-widest mb-2">Required columns</p>
            <div className="flex flex-wrap gap-1.5">
              {["employee_id","name","address","area","shift_time"].map(col => (
                <span key={col} className="tag border-brand-800 text-brand-300 bg-brand-900/20 font-mono">{col}</span>
              ))}
              {["shift_type","phone"].map(col => (
                <span key={col} className="tag border-dark-500 text-slate-500">{col} optional</span>
              ))}
            </div>
          </div>
        </div>

        {/* Config — 2 cols */}
        <div className="md:col-span-2 flex flex-col gap-4 animate-fade-up-delay-2">
          <div className="card p-5 flex flex-col gap-4">
            <p className="font-display font-bold text-white text-sm uppercase tracking-widest">Configuration</p>
            <Field label="Cab Capacity" field="cab_capacity" hint="Max employees per cab" />
            <Field label="Rate / KM (Rs.)" field="rate_per_km" step={0.5} hint="Cost per kilometre" />
            <Field label="Working Days / Month" field="working_days" hint="For monthly cost estimate" />
          </div>
          <div className="card p-5 flex flex-col gap-4">
            <p className="font-display font-bold text-white text-sm uppercase tracking-widest">Office Location</p>
            <Field label="Latitude" field="office_lat" step={0.0001} />
            <Field label="Longitude" field="office_lng" step={0.0001} />
            <p className="text-xs text-slate-600">Default: Koramangala, Bangalore</p>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="w-full max-w-3xl mt-4 p-4 rounded-xl bg-red-950/50 border border-red-800 text-red-300 text-sm font-body animate-fade-up">
          ⚠️ {error}
        </div>
      )}

      {/* Submit */}
      <div className="w-full max-w-3xl mt-6 animate-fade-up-delay-3">
        <button onClick={handleSubmit} disabled={loading || !file} className="btn-primary w-full py-4 text-base">
          {loading ? (
            <span className="flex items-center justify-center gap-3">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {stage}
            </span>
          ) : "Optimize Routes →"}
        </button>
        {loading && (
          <p className="text-center text-xs text-slate-600 mt-2 font-mono">
            Geocoding addresses via OpenStreetMap · this takes ~60s for 50 employees
          </p>
        )}
      </div>

      {/* Footer nav */}
      <div className="mt-8">
        <button onClick={() => navigate("/history")} className="btn-ghost text-sm">
          View past runs →
        </button>
      </div>
    </div>
  );
}
