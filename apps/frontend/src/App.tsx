const healthEndpoints = [
  "/health",
  "/api/auth/health",
  "/api/catalog/health",
  "/api/reservations/health",
];

export default function App() {
  return (
    <main className="shell">
      <section className="panel">
        <p className="eyebrow">saasPlug</p>
        <h1>Infrastructure baseline</h1>
        <p className="summary">
          This placeholder verifies the Docker Compose and Nginx gateway
          baseline. Product flows, authentication, maps, dashboards,
          reservations, analytics, and billing are intentionally not
          implemented yet.
        </p>
        <div className="health-list" aria-label="Health endpoints">
          {healthEndpoints.map((endpoint) => (
            <code key={endpoint}>{endpoint}</code>
          ))}
        </div>
      </section>
    </main>
  );
}
