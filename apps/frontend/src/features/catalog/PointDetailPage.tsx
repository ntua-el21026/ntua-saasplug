import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { AppShell } from "../../components/AppShell";
import { ProviderBadge } from "../../components/domain/provider";
import { ReservationModal } from "../../components/domain/ev";
import { Alert, LoadingBlock } from "../../components/Feedback";
import { StatusBadge } from "../../components/StatusBadge";
import { Button, PageHeader } from "../../components/ui";
import { useAuth } from "../auth/AuthContext";
import { requestJson, messageFromUnknownError } from "../../lib/api";
import { formatCapacity, formatDateTime, formatPrice, providerLabel } from "../../lib/formatting";
import type { CatalogPointDetail, Reservation, StatusCacheResponse, StatusLookupResponse } from "../../lib/types";

export function PointDetailPage() {
  const { providerCode = "", externalPointId = "" } = useParams();
  const { session } = useAuth();
  const [point, setPoint] = useState<CatalogPointDetail | null>(null);
  const [status, setStatus] = useState<StatusLookupResponse | StatusCacheResponse | null>(null);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [reservationLoading, setReservationLoading] = useState(false);
  const [reservationDialogOpen, setReservationDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [reservationError, setReservationError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadPoint() {
      setLoading(true);
      setError(null);
      try {
        const payload = await requestJson<CatalogPointDetail>(
          `/api/catalog/points/${encodeURIComponent(providerCode)}/${encodeURIComponent(externalPointId)}`,
          { accessToken: session?.accessToken },
        );
        if (!cancelled) {
          setPoint(payload);
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
    loadPoint();
    return () => {
      cancelled = true;
    };
  }, [externalPointId, providerCode, session?.accessToken]);

  useEffect(() => {
    if (session?.accessToken) {
      lookupStatus(false);
    }
  }, [session?.accessToken, providerCode, externalPointId]);

  async function lookupStatus(forceRefresh: boolean) {
    setStatusLoading(true);
    setStatusError(null);
    try {
      const payload = await requestJson<StatusLookupResponse>(
        `/api/status/points/${encodeURIComponent(providerCode)}/${encodeURIComponent(externalPointId)}/status?forceRefresh=${forceRefresh}`,
        { accessToken: session?.accessToken },
      );
      setStatus(payload);
    } catch (caught) {
      setStatusError(messageFromUnknownError(caught));
      if (!forceRefresh) {
        try {
          const cached = await requestJson<StatusCacheResponse>(
            `/api/status/cache/${encodeURIComponent(providerCode)}/${encodeURIComponent(externalPointId)}`,
            { accessToken: session?.accessToken },
          );
          setStatus(cached);
        } catch {
          return;
        }
      }
    } finally {
      setStatusLoading(false);
    }
  }

  async function reserve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReservation(null);
    setReservationError(null);
    setReservationDialogOpen(true);
    setReservationLoading(true);
    try {
      const payload = await requestJson<Reservation>(
        `/api/reservations/points/${encodeURIComponent(providerCode)}/${encodeURIComponent(externalPointId)}/reservations`,
        {
          method: "POST",
          accessToken: session?.accessToken,
          bodyJson: { duration_minutes: durationMinutes },
        },
      );
      setReservation(payload);
    } catch (caught) {
      setReservationError(messageFromUnknownError(caught));
    } finally {
      setReservationLoading(false);
    }
  }

  return (
    <AppShell>
      <main className="page">
        {loading ? <LoadingBlock label="Loading point details" /> : null}
        {error ? (
          <Alert tone="danger" title="Point unavailable">
            {error}
          </Alert>
        ) : null}

        {point ? (
          <>
            <PageHeader
              title={point.display_name}
              description={point.address ?? point.location_name ?? point.normalized_point_id}
              actions={
                <div className="point-hero-status">
                  <ProviderBadge providerCode={point.provider_code} />
                  <StatusBadge status={status?.status ?? point.status} />
                  <span>{formatPrice(point.price_per_kwh_eur)}</span>
                </div>
              }
            />

            <section className="detail-layout">
              <div className="surface">
                <div className="surface-header">
                  <div>
                    <h2>Catalog detail</h2>
                    <p>Provider-normalized catalog data.</p>
                  </div>
                </div>
                <dl className="detail-list">
                  <div>
                    <dt>Provider point ID</dt>
                    <dd>{point.normalized_point_id}</dd>
                  </div>
                  <div>
                    <dt>Connector</dt>
                    <dd>{point.connector ?? "Connector unknown"}</dd>
                  </div>
                  <div>
                    <dt>Capacity</dt>
                    <dd>{formatCapacity(point.capacity)}</dd>
                  </div>
                  <div>
                    <dt>Coordinates</dt>
                    <dd>
                      {point.latitude === null || point.longitude === null
                        ? "Coordinates unavailable"
                        : `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`}
                    </dd>
                  </div>
                  <div>
                    <dt>Coordinate source</dt>
                    <dd>{point.coordinate_source === "demo_synthetic" ? "Demo map coordinates" : point.coordinate_source}</dd>
                  </div>
                  <div>
                    <dt>Catalog sync</dt>
                    <dd>{formatDateTime(point.last_catalog_sync_at)}</dd>
                  </div>
                </dl>
              </div>

              <div className="surface">
                <div className="surface-header">
                  <div>
                    <h2>Status</h2>
                    <p>Status-service lookup with cache metadata</p>
                  </div>
                  <button className="button-secondary" type="button" onClick={() => lookupStatus(true)} disabled={statusLoading}>
                    Refresh status
                  </button>
                </div>
                {statusLoading ? <LoadingBlock label="Checking status" /> : null}
                {statusError ? (
                  <Alert tone="warning" title="Status lookup warning">
                    {statusError}
                  </Alert>
                ) : null}
                {status ? (
                  <dl className="detail-list">
                    <div>
                      <dt>Status</dt>
                      <dd><StatusBadge status={status.status} /></dd>
                    </div>
                    <div>
                      <dt>Checked</dt>
                      <dd>{formatDateTime("checked_at" in status ? status.checked_at : status.last_checked_at)}</dd>
                    </div>
                    <div>
                      <dt>Expires</dt>
                      <dd>{formatDateTime(status.expires_at)}</dd>
                    </div>
                    {"cache_hit" in status ? (
                      <>
                        <div>
                          <dt>Cache hit</dt>
                          <dd>{status.cache_hit ? "Yes" : "No"}</dd>
                        </div>
                        <div>
                          <dt>Provider called</dt>
                          <dd>{status.provider_called ? "Yes" : "No"}</dd>
                        </div>
                        <div>
                          <dt>Returned stale</dt>
                          <dd>{status.returned_stale ? "Yes" : "No"}</dd>
                        </div>
                      </>
                    ) : null}
                    {"warning" in status && status.warning ? (
                      <div>
                        <dt>Warning</dt>
                        <dd>{status.warning}</dd>
                      </div>
                    ) : null}
                  </dl>
                ) : (
                  <p className="muted">No status response is available yet.</p>
                )}
              </div>

              <form className="surface reservation-box" onSubmit={reserve}>
                <div className="surface-header">
                  <div>
                    <h2>Reserve charger</h2>
                    <p>Synchronous reservation through reservation-service</p>
                  </div>
                </div>
                <label>
                  Duration in minutes
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    value={durationMinutes}
                    onChange={(event) => setDurationMinutes(Number(event.target.value))}
                  />
                </label>
                <button className="button-primary" type="submit" disabled={reservationLoading}>
                  {reservationLoading ? "Checking availability..." : "Create reservation"}
                </button>
                <ReservationModal open={reservationDialogOpen} title="Reservation status">
                  {reservationLoading ? <LoadingBlock label="Checking provider availability" /> : null}
                  {reservation ? (
                    <Alert tone={reservation.status === "succeeded" ? "success" : "warning"} title="Reservation response">
                      Reservation {reservation.status}. <Link to="/reservations">Open reservation history</Link>.
                    </Alert>
                  ) : null}
                  {reservationError ? (
                    <Alert tone="danger" title={reservationError.toLowerCase().includes("timeout") ? "Provider timeout" : "Reservation failed"}>
                      {reservationError}
                    </Alert>
                  ) : null}
                  {!reservationLoading ? (
                    <div className="button-row">
                      <Button variant="secondary" type="button" onClick={() => setReservationDialogOpen(false)}>
                        Close
                      </Button>
                      {reservationError ? (
                        <Button type="submit">
                          Retry
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </ReservationModal>
              </form>
            </section>
          </>
        ) : null}
      </main>
    </AppShell>
  );
}
