// src/utils/colors.js
// Distinct colors for each cab route on the map and UI

export const ROUTE_COLORS = [
  "#3cb67f", // brand green
  "#60a5fa", // blue
  "#f59e0b", // amber
  "#f472b6", // pink
  "#a78bfa", // violet
  "#34d399", // emerald
  "#fb923c", // orange
  "#22d3ee", // cyan
  "#e879f9", // fuchsia
  "#facc15", // yellow
];

export const getRouteColor = (index) =>
  ROUTE_COLORS[index % ROUTE_COLORS.length];

export const formatRupees = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(amount);

export const formatKm = (km) => `${Number(km).toFixed(1)} km`;
