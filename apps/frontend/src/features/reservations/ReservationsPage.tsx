import { useEffect, useState } from "react";
import { AppShell } from "../../components/AppShell";
import { ReservationCard } from "../../components/domain/ev";
import { Alert, EmptyState, LoadingBlock } from "../../components/Feedback";
import { useAuth } from "../auth/AuthContext";
import { requestJson, messageFromUnknownError } from "../../lib/api";
import { MetricCard, PageHeader, Select } from "../../components/ui";
import { formatDurationMinutes, formatMoney, formatNumber } from "../../lib/formatting";
import type { EvReservationSummary, Reservation } from "../../lib/types";

const RESERVATION_LIMIT_OPTIONS = [20, 40, 60, 80, 100, "all"] as const;
type ReservationLimit = (typeof RESERVATION_LIMIT_OPTIONS)[number];

export function ReservationsPage() {
  const { session } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [summary, setSummary] = useState<EvReservationSummary | null>(null);
  const [displayLimit, setDisplayLimit] = useState<ReservationLimit>(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadReservations() {
      setLoading(true);
      setError(null);
      setSummaryError(null);
      try {
        const [reservationsResult, summaryResult] = await Promise.allSettled([
          requestJson<Reservation[]>("/api/reservations/reservations/me", {
            accessToken: session?.accessToken,
          }),
          requestJson<EvReservationSummary>("/api/analytics/ev/reservations/summary", {
            accessToken: session?.accessToken,
          }),
        ]);
        if (!cancelled) {
          if (reservationsResult.status === "fulfilled") {
            setReservations(reservationsResult.value);
          } else {
            setError(messageFromUnknownError(reservationsResult.reason));
          }
          if (summaryResult.status === "fulfilled") {
            setSummary(summaryResult.value);
          } else {
            setSummary(null);
            setSummaryError(messageFromUnknownError(summaryResult.reason));
          }
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

  const visibleReservations = displayLimit === "all" ? reservations : reservations.slice(0, displayLimit);
  const shownCount = visibleReservations.length;

  return (
    <AppShell>
      <main className="page page-narrow reservation-page">
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
        {summaryError && !error ? (
          <Alert tone="warning" title="Reservation analytics unavailable">
            {summaryError}
          </Alert>
        ) : null}
        {!loading && !error && summary ? <ReservationSummaryStrip summary={summary} /> : null}
        {!loading && !error && reservations.length === 0 ? (
          <EmptyState title="No reservations yet">
            Select a charging point from the map to start a reservation when provider credentials are available.
          </EmptyState>
        ) : null}

        {!loading && !error && reservations.length > 0 ? (
          <section className="reservation-history-panel" aria-label="Reservation history">
            <div className="reservation-list-toolbar">
              <div>
                <strong>Reservation history</strong>
                <span className="muted">
                  Showing {formatNumber(shownCount)} of {formatNumber(reservations.length)}
                </span>
              </div>
              <label className="reservation-limit-control">
                <span>Show</span>
                <Select
                  value={String(displayLimit)}
                  onChange={(event) => {
                    const value = event.target.value;
                    setDisplayLimit(value === "all" ? "all" : Number(value) as ReservationLimit);
                  }}
                >
                  {RESERVATION_LIMIT_OPTIONS.map((option) => (
                    <option key={option} value={String(option)}>
                      {option === "all" ? "Full list" : `${option} entries`}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
            <div className="reservation-list" role="list" aria-label="Reservations">
              {visibleReservations.map((reservation) => (
                <ReservationCard key={reservation.id} reservation={reservation} />
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </AppShell>
  );
}

function ReservationSummaryStrip({ summary }: { summary: EvReservationSummary }) {
  const estimateHint = summary.estimated_reservations > 0
    ? `${formatNumber(summary.estimated_reservations)} priced reservations`
    : "Waiting for complete cost data";
  return (
    <section className="ev-reservation-summary" aria-label="Reservation analytics">
      <MetricCard
        label="Avg estimate/point"
        value={formatMoney(summary.average_estimated_cost_per_point_eur, summary.currency ?? "EUR")}
        hint={estimateHint}
      />
      <MetricCard label="Total estimate" value={formatMoney(summary.total_estimated_cost_eur, summary.currency ?? "EUR")} hint="Rated-power estimate" />
      <MetricCard label="Reservations" value={formatNumber(summary.total_reservations)} hint={`${formatNumber(summary.successful_reservations)} succeeded`} />
      <MetricCard label="Reserved duration" value={formatDurationMinutes(summary.total_duration_minutes)} hint={`${formatNumber(summary.distinct_points)} unique points`} />
      {summary.missing_estimate_count > 0 ? (
        <p className="ev-reservation-summary-note">
          {formatNumber(summary.missing_estimate_count)} successful reservations are missing cost/kWh or charger power, so they are excluded from cost estimates.
        </p>
      ) : null}
      {summary.analytics_delay_notice && summary.analytics_delay_notice !== "aggregates_current" ? (
        <p className="ev-reservation-summary-note">
          Analytics status: {summary.analytics_delay_notice.replace(/_/g, " ")}.
        </p>
      ) : null}
    </section>
  );
}
