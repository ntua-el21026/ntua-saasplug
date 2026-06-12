import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { AppShell } from "../../components/AppShell";
import { Alert, EmptyState, LoadingBlock } from "../../components/Feedback";
import { StatusBadge } from "../../components/StatusBadge";
import { useAuth } from "../auth/AuthContext";
import { requestJson, messageFromUnknownError } from "../../lib/api";
import { formatDateTime, formatPrice, providerLabel } from "../../lib/formatting";
import { pointPath } from "../../lib/routing";
import type { Reservation } from "../../lib/types";

export function ReservationsPage() {
  const { session } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadReservations() {
      setLoading(true);
      setError(null);
      try {
        const payload = await requestJson<Reservation[]>("/api/reservations/reservations/me", {
          accessToken: session?.accessToken,
        });
        if (!cancelled) {
          setReservations(payload);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(messageFromUnknownError(caught));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    loadReservations();
    return () => {
      cancelled = true;
    };
  }, [session?.accessToken]);

  return (
    <AppShell>
      <main className="page page-narrow">
        <section className="page-heading">
          <p className="eyebrow">My reservations</p>
          <h1>Reservation history</h1>
          <p>Reservation records are read from reservation-service using your EV user token.</p>
        </section>

        {loading ? <LoadingBlock label="Loading reservations" /> : null}
        {error ? (
          <Alert tone="danger" title="Reservation history unavailable">
            {error}
          </Alert>
        ) : null}
        {!loading && !error && reservations.length === 0 ? (
          <EmptyState title="No reservations yet">
            Open the map, select a charging point, and create a reservation when provider credentials are available.
          </EmptyState>
        ) : null}

        <section className="reservation-list" aria-label="Reservation history">
          {reservations.map((reservation) => (
            <article key={reservation.id} className="reservation-card">
              <div>
                <strong>{providerLabel(reservation.provider_code)} point {reservation.external_point_id}</strong>
                <small>{reservation.normalized_point_id}</small>
              </div>
              <StatusBadge status={reservation.status} />
              <dl className="reservation-meta">
                <div>
                  <dt>Created</dt>
                  <dd>{formatDateTime(reservation.created_at)}</dd>
                </div>
                <div>
                  <dt>Duration</dt>
                  <dd>{reservation.requested_duration_minutes} min</dd>
                </div>
                <div>
                  <dt>Provider status</dt>
                  <dd>{reservation.provider_status ?? "unknown"}</dd>
                </div>
                <div>
                  <dt>Price</dt>
                  <dd>{formatPrice(reservation.price_per_kwh_eur)}</dd>
                </div>
              </dl>
              {reservation.failure_reason ? <p className="muted">{reservation.failure_reason}</p> : null}
              <Link to={pointPath(reservation.provider_code, reservation.external_point_id)} className="text-link">
                Open point
              </Link>
            </article>
          ))}
        </section>
      </main>
    </AppShell>
  );
}
