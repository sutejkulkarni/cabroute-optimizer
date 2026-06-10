// src/pages/HistoryPage.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAllRuns, deleteRun } from "../services/api";
import { formatRupees } from "../utils/colors";

export default function HistoryPage() {
  const navigate = useNavigate();
  const [runs, setRuns]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);

  const load = () => {
    setLoading(true);
    getAllRuns()
      .then(d => setRuns(d.runs || []))
      .catch(() => setRuns([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (run_id, e) => {
    e.stopPropagation();
    if (!confirm("Delete this run?")) return;
    setDeleting(run_id);
    await deleteRun(run_id).catch(() => {});
    setRuns(r => r.filter(x => x.run_id !== run_id));
    setDeleting(null);
  };

  return (
    <div className="min-h-screen bg-dark-900 px-6 py-10">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8 animate-fade-up">
          <div>
            <button onClick={() => navigate("/")} className="text-slate-500 hover:text-brand-400 text-sm mb-2 block transition-colors">← New Upload</button>
            <h1 className="font-display font-extrabold text-3xl text-white">Run History</h1>
            <p className="text-slate-500 text-sm mt-1">All past optimization runs stored in MongoDB</p>
          </div>
          <button onClick={load} className="btn-ghost text-sm">↻ Refresh</button>
        </div>

        {/* Runs list */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
          </div>
        ) : runs.length === 0 ? (
          <div className="card p-12 text-center animate-fade-up">
            <p className="text-4xl mb-4">📭</p>
            <p className="font-display font-semibold text-white text-lg mb-2">No runs yet</p>
            <p className="text-slate-500 text-sm mb-6">Upload an Excel file to create your first optimization run.</p>
            <button onClick={() => navigate("/")} className="btn-primary">Upload Now →</button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 animate-fade-up">
            {runs.map((run, i) => (
              <div
                key={run.run_id}
                onClick={() => navigate(`/results/${run.run_id}`)}
                className="card p-5 cursor-pointer hover:border-brand-600 transition-all duration-200 animate-fade-up"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`tag font-mono text-xs ${
                        run.status === "complete" ? "border-brand-800 text-brand-400 bg-brand-900/20" :
                        run.status === "error"    ? "border-red-800 text-red-400 bg-red-900/20" :
                        "border-amber-800 text-amber-400 bg-amber-900/20"
                      }`}>{run.status}</span>
                      <span className="font-display font-semibold text-white text-sm truncate">
                        {run.original_filename || "employees.xlsx"}
                      </span>
                    </div>
                    <div className="flex gap-4 text-xs text-slate-500 font-mono flex-wrap mt-2">
                      {run.summary?.total_cabs !== undefined && (
                        <span className="text-brand-400 font-semibold">{run.summary.total_cabs} cabs</span>
                      )}
                      {run.summary?.total_employees_routed !== undefined && (
                        <span>{run.summary.total_employees_routed} employees</span>
                      )}
                      {run.summary?.total_monthly_cost_rs !== undefined && (
                        <span>{formatRupees(run.summary.total_monthly_cost_rs)}/month</span>
                      )}
                      <span className="text-slate-600">
                        {new Date(run.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric", month: "short", year: "numeric",
                          hour: "2-digit", minute: "2-digit"
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 font-mono mt-1">{run.run_id}</p>
                  </div>
                  <button
                    onClick={e => handleDelete(run.run_id, e)}
                    disabled={deleting === run.run_id}
                    className="ml-4 text-slate-600 hover:text-red-400 transition-colors text-lg shrink-0"
                  >
                    {deleting === run.run_id ? "..." : "🗑"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
