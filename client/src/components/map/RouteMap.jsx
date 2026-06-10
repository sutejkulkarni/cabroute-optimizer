// src/components/map/RouteMap.jsx
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getRouteColor } from "../../utils/colors";

// Fix default leaflet icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const officeIcon = L.divIcon({
  html: `<div style="width:28px;height:28px;background:#1e9962;border:3px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.5)">🏢</div>`,
  className: "", iconAnchor: [14, 14],
});

const stopIcon = (color, num) => L.divIcon({
  html: `<div style="width:24px;height:24px;background:${color};border:2px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:white;box-shadow:0 2px 6px rgba(0,0,0,0.4)">${num}</div>`,
  className: "", iconAnchor: [12, 12],
});

function FitBounds({ routes }) {
  const map = useMap();
  if (!routes?.length) return null;
  const all = routes.flatMap(r => r.waypoints || []);
  if (all.length > 1) {
    try { map.fitBounds(all, { padding: [40, 40] }); } catch {}
  }
  return null;
}

export default function RouteMap({ routes = [], activeRouteId = null, officeLat = 12.9352, officeLng = 77.6245 }) {
  const visibleRoutes = activeRouteId
    ? routes.filter(r => r.cab_id === activeRouteId)
    : routes;

  return (
    <MapContainer
      center={[officeLat, officeLng]}
      zoom={12}
      style={{ height: "100%", width: "100%", minHeight: 420 }}
      zoomControl={true}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
      />
      <FitBounds routes={visibleRoutes} />

      {/* Office marker */}
      <Marker position={[officeLat, officeLng]} icon={officeIcon}>
        <Popup>
          <div className="font-body text-sm">
            <strong>🏢 Office / Depot</strong><br />
            Pickup destination for all routes
          </div>
        </Popup>
      </Marker>

      {visibleRoutes.map((route, ri) => {
        const color = getRouteColor(route.cab_id - 1);
        const waypoints = route.waypoints || [];
        if (waypoints.length < 2) return null;

        return (
          <div key={route.cab_id}>
            {/* Route polyline */}
            <Polyline
              positions={waypoints}
              pathOptions={{ color, weight: activeRouteId === route.cab_id ? 5 : 3, opacity: 0.85, dashArray: null }}
            />
            {/* Employee stop markers */}
            {route.employees?.map((emp, ei) => (
              <Marker
                key={emp.employee_id}
                position={[emp.lat, emp.lng]}
                icon={stopIcon(color, emp.pickup_order)}
              >
                <Popup>
                  <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13 }}>
                    <strong style={{ color }}>Stop {emp.pickup_order} — Cab {route.cab_id}</strong><br />
                    {emp.name}<br />
                    <span style={{ color: "#888", fontSize: 11 }}>{emp.area}</span>
                  </div>
                </Popup>
              </Marker>
            ))}
          </div>
        );
      })}
    </MapContainer>
  );
}
