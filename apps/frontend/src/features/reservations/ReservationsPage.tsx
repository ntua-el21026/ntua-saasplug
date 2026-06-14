import { useEffect, useState } from "react";
import { AppShell } from "../../components/AppShell";
import { ReservationCard } from "../../components/domain/ev";
import { Alert, EmptyState, LoadingBlock } from "../../components/Feedback";
import { useAuth } from "../auth/AuthContext";
import { requestJson, messageFromUnknownError } from "../../lib/api";
import { PageHeader } from "../../components/ui";
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
        <PageHeader
          title="Reservations"
          description="Track charger reservation attempts and provider responses from your account."
        />

        {loading ? <LoadingBlock label="Loading reservations" /> : null}
        {error ? (
          <Alert tone="danger" title="Reservations unavailable">
            {error}
          </Alert>
        ) : null}
        {!loading && !error && reservations.length === 0 ? (
          <EmptyState title="No reservations yet">
            Select a charging point from the map to start a reservation when provider credentials are available.
          </EmptyState>
        ) : null}

        <section className="reservation-list" aria-label="Reservations">
          {reservations.map((reservation) => (
            <ReservationCard key={reservation.id} reservation={reservation} />
          ))}
        </section>
      </main>
    </AppShell>
  );
}
