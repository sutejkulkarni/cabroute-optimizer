// src/pages/ResultsPage.jsx
import { useState, useEffect } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { getRunById } from "../services/api";
import RouteMap from "../components/map/RouteMap";
import { getRouteColor, formatRupees, formatKm } from "../utils/colors";

export default function ResultsPage() {
  const { run_id }    = useParams();
  const location      = useLocation();
  const navigate      = useNavigate();
  const [data, setData]           = useState(location.state || null);
  const [loading, setLoading]     = useState(!location.state);
  const [activeRoute, setActive]  = useState(null);
  const [activeTab, setActiveTab] = useState("map");

  useEffect(() => {
    if (!data) {
      getRunById(run_id)
        .then(run => setData(run))
        .catch(() => navigate("/"))
        .finally(() => setLoading(false));
    }
  }, [run_id]);

  if (loading) return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
        <p className="text-slate-400 font-body">Loading results...</p>
      </div>
    </div>
  );

  if (!data) return null;

  const summary = data.summary || data.run?.summary;
  const routes  = data.routes  || data.run?.routes  || [];
  const config  = data.config  || data.run?.config  || {};
  const skipped = data.skipped_employees || data.run?.skipped_employees || [];

  const officeLat = config?.office?.lat || 12.9352;
  const officeLng = config?.office?.lng || 77.6245;

  return (
    <div className="min-h-screen bg-dark-900 text-slate-200">

      {/* Top bar */}
      <div className="border-b border-dark-600 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-slate-500 hover:text-brand-400 transition-colors text-sm">← Upload</button>
          <span className="text-dark-500">|</span>
          <span className="font-display font-bold text-white">Results</span>
          <span className="tag border-brand-800 text-brand-400 bg-brand-900/30 font-mono text-xs">{run_id?.slice(0, 8)}</span>
        </div>
        <button onClick={() => navigate("/history")} className="btn-ghost text-sm">History →</button>
      </div>

      {/* Summary stat cards */}
      <div className="px-6 py-5 grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-up">
        <StatCard label="Cabs Needed"      value={summary?.total_cabs}                       accent="brand" />
        <StatCard label="Employees Routed" value={summary?.total_employees_routed}            accent="blue"  />
        <StatCard label="Daily Distance"   value={formatKm(summary?.total_km_daily)}          accent="amber" />
        <StatCard label="Monthly Cost"     value={formatRupees(summary?.total_monthly_cost_rs)} accent="pink" />
      </div>

      {/* Main content */}
      <div className="px-6 pb-10 grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Map — 2 cols */}
        <div className="lg:col-span-2 card overflow-hidden animate-fade-up-delay-1" style={{ height: 520 }}>
          <div className="px-4 py-3 border-b border-dark-600 flex items-center justify-between">
            <p className="font-display font-semibold text-white text-sm">Route Map</p>
            <div className="flex gap-2">
              {activeRoute && (
                <button onClick={() => setActive(null)} className="text-xs text-brand-400 hover:text-brand-300">
                  Show all
                </button>
              )}
              <span className="text-xs text-slate-600 font-mono">OpenStreetMap</span>
            </div>
          </div>
          <div style={{ height: "calc(100% - 44px)" }}>
            <RouteMap
              routes={routes}
              activeRouteId={activeRoute}
              officeLat={officeLat}
              officeLng={officeLng}
            />
          </div>
        </div>

        {/* Route list — 1 col */}
        <div className="flex flex-col gap-3 animate-fade-up-delay-2">
          {/* Tabs */}
          <div className="flex gap-2">
            {["map","shifts","skipped"].map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`text-xs font-display font-semibold uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all
                  ${activeTab === t ? "bg-brand-500 text-white" : "text-slate-500 hover:text-slate-300"}`}>
                {t}{t === "skipped" && skipped.length ? ` (${skipped.length})` : ""}
              </button>
            ))}
          </div>

          {/* Routes list */}
          {activeTab === "map" && (
            <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: 440 }}>
              {routes.map(route => {
                const color = getRouteColor(route.cab_id - 1);
                const isActive = activeRoute === route.cab_id;
                return (
                  <button key={route.cab_id}
                    onClick={() => setActive(isActive ? null : route.cab_id)}
                    className={`card p-4 text-left transition-all duration-200 hover:border-brand-600
                      ${isActive ? "border-brand-500 bg-brand-900/20" : ""}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ background: color }} />
                        <span className="font-display font-bold text-white text-sm">Cab {route.cab_id}</span>
                        <span className="tag border-dark-500 text-slate-500 font-mono">{route.shift_time}</span>
                      </div>
                      <span className="text-xs text-slate-500 font-mono">{formatKm(route.distance_km)}</span>
                    </div>
                    <div className="text-xs text-slate-400 mb-2 font-mono">
                      {route.employees?.map(e => e.name.split(" ")[0]).join(" → ")} → Office
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">{route.employee_count} employees</span>
                      <span style={{ color }}>{formatRupees(route.daily_cost)}/day</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* By shift breakdown */}
          {activeTab === "shifts" && (
            <div className="flex flex-col gap-2">
              {Object.entries(summary?.by_shift || {}).map(([shift, data]) => (
                <div key={shift} className="card p-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-display font-bold text-white">Shift {shift}</span>
                    <span className="tag border-brand-800 text-brand-400 font-mono">{data.cabs} cabs</span>
                  </div>
                  <div className="text-xs text-slate-400 flex gap-4 mt-2">
                    <span>{data.employees} employees</span>
                    <span>{formatRupees(data.daily_cost)}/day</span>
                    <span>{formatRupees(data.daily_cost * (config.working_days || 26))}/month</span>
                  </div>
                </div>
              ))}
              {/* Config used */}
              <div className="card p-4 mt-2">
                <p className="text-xs font-display font-semibold text-slate-500 uppercase tracking-widest mb-3">Config Used</p>
                {[
                  ["Cab Capacity", `${config.cab_capacity} pax`],
                  ["Rate / KM", `Rs. ${config.rate_per_km}`],
                  ["Working Days", `${config.working_days}/month`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs py-1 border-b border-dark-600">
                    <span className="text-slate-500">{k}</span>
                    <span className="text-slate-300 font-mono">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Skipped employees */}
          {activeTab === "skipped" && (
            <div className="flex flex-col gap-2">
              {skipped.length === 0 ? (
                <div className="card p-6 text-center text-slate-500 text-sm">
                  ✅ All employees geocoded successfully
                </div>
              ) : (
                <>
                  <p className="text-xs text-amber-400 font-body px-1">
                    These employees couldn't be geocoded and were excluded from routing.
                    Try adding more address detail (locality + city).
                  </p>
                  {skipped.map(emp => (
                    <div key={emp.employee_id} className="card p-3">
                      <p className="text-sm text-white font-body">{emp.name}</p>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">{emp.address?.slice(0, 60)}...</p>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }) {
  const colors = {
    brand: "text-brand-400",
    blue:  "text-blue-400",
    amber: "text-amber-400",
    pink:  "text-pink-400",
  };
  return (
    <div className="stat-card">
      <p className="text-xs font-display font-semibold text-slate-500 uppercase tracking-widest">{label}</p>
      <p className={`font-display font-extrabold text-2xl ${colors[accent]}`}>{value ?? "—"}</p>
    </div>
  );
}
