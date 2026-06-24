import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { AccessDenied } from "../../components/AccessDenied";
import { AppShell } from "../../components/AppShell";
import { ProviderBadge } from "../../components/domain/provider";
import { ReservationModal } from "../../components/domain/ev";
import { Alert, LoadingBlock } from "../../components/Feedback";
import { StatusBadge } from "../../components/StatusBadge";
import { Button, PageHeader } from "../../components/ui";
import { useAuth } from "../auth/AuthContext";
import { requestJson, messageFromUnknownError } from "../../lib/api";
import { formatCapacity, formatCostPerKwh, formatDateTime } from "../../lib/formatting";
import type { CatalogPointDetail, Reservation, StatusCacheResponse, StatusLookupResponse } from "../../lib/types";

export function PointDetailPage() {
  const { providerCode = "", externalPointId = "" } = useParams();
  const { session } = useAuth();
  const [point, setPoint] = useState<CatalogPointDetail | null>(null);
  const [status, setStatus] = useState<StatusLookupResponse | StatusCacheResponse | null>(null);
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [reservationLoading, setReservationLoading] = useState(false);
  const [reservationDialogOpen, setReservationDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [reservationError, setReservationError] = useState<string | null>(null);
  const isEvUser = session?.user.roles.includes("EV_USER") ?? false;
  const isProviderAdmin = session?.user.roles.includes("PROVIDER_ADMIN") ?? false;
  const isOwnProviderPoint = !isProviderAdmin || session?.user.provider_code === providerCode;

  useEffect(() => {
    if (!isOwnProviderPoint) {
      setLoading(false);
      return;
    }
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
  }, [externalPointId, isOwnProviderPoint, providerCode, session?.accessToken]);

  useEffect(() => {
    if (session?.accessToken && isOwnProviderPoint) {
      lookupStatus();
    }
  }, [session?.accessToken, isOwnProviderPoint, providerCode, externalPointId]);

  async function lookupStatus() {
    setStatusLoading(true);
    setStatusError(null);
    try {
      const payload = await requestJson<StatusLookupResponse>(
        `/api/status/points/${encodeURIComponent(providerCode)}/${encodeURIComponent(externalPointId)}/status?forceRefresh=false`,
        { accessToken: session?.accessToken },
      );
      setStatus(payload);
    } catch (caught) {
      setStatusError(messageFromUnknownError(caught));
      try {
        const cached = await requestJson<StatusCacheResponse>(
          `/api/status/cache/${encodeURIComponent(providerCode)}/${encodeURIComponent(externalPointId)}`,
          { accessToken: session?.accessToken },
        );
        setStatus(cached);
      } catch {
        return;
      }
    } finally {
      setStatusLoading(false);
    }
  }

  async function reserve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isEvUser) {
      return;
    }
    setReservation(null);
    setReservationError(null);
    setReservationDialogOpen(true);
    setReservationLoading(true);
    const parsedDuration = Number.parseInt(durationMinutes, 10);
    if (!Number.isFinite(parsedDuration) || parsedDuration < 1 || parsedDuration > 1440) {
      setReservationError("Enter a charging duration between 1 and 1440 minutes.");
      setReservationLoading(false);
      return;
    }
    try {
      const payload = await requestJson<Reservation>(
        `/api/reservations/points/${encodeURIComponent(providerCode)}/${encodeURIComponent(externalPointId)}/reservations`,
        {
          method: "POST",
          accessToken: session?.accessToken,
          bodyJson: { duration_minutes: parsedDuration },
        },
      );
      setReservation(payload);
    } catch (caught) {
      setReservationError(messageFromUnknownError(caught));
    } finally {
      setReservationLoading(false);
    }
  }

  if (!isOwnProviderPoint) {
    return <AccessDenied />;
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
                  <span>{formatCostPerKwh(point.price_per_kwh_eur)}</span>
                </div>
              }
            />

            <section className="detail-layout">
              <div className="surface">
                <div className="surface-header">
                  <div>
                    <h2>Charging point details</h2>
                    <p>Core information for this charging location.</p>
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
                    <dd>{point.coordinate_source === "demo_synthetic" ? "Estimated map position" : point.coordinate_source}</dd>
                  </div>
                  <div>
                    <dt>Last catalog update</dt>
                    <dd>{formatDateTime(point.last_catalog_sync_at)}</dd>
                  </div>
                </dl>
              </div>

              <div className="surface">
                <div className="surface-header">
                  <div>
                    <h2>Status</h2>
                    <p>Latest known charger availability and update timing.</p>
                  </div>
                </div>
                {statusLoading ? <LoadingBlock label="Checking status" /> : null}
                {statusError ? (
                  <Alert tone="warning" title="Availability warning">
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
                          <dt>Recently checked</dt>
                          <dd>{status.cache_hit ? "Yes" : "No"}</dd>
                        </div>
                        <div>
                          <dt>Live check</dt>
                          <dd>{status.provider_called ? "Yes" : "No"}</dd>
                        </div>
                        <div>
                          <dt>Older result</dt>
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

              {isEvUser ? (
                <form className="surface reservation-box" onSubmit={reserve}>
                  <div className="surface-header">
                    <div>
                      <h2>Reserve charger</h2>
                      <p>Choose a charging duration and confirm availability before reserving this charger.</p>
                    </div>
                  </div>
                  <label>
                    Duration in minutes
                    <input
                      type="number"
                      min={1}
                      max={1440}
                      step={1}
                      required
                      value={durationMinutes}
                      onChange={(event) => setDurationMinutes(event.target.value)}
                    />
                  </label>
                  <button className="button-primary" type="submit" disabled={reservationLoading}>
                    {reservationLoading ? "Checking availability..." : "Create reservation"}
                  </button>
                  <ReservationModal open={reservationDialogOpen} title="Reservation status" onClose={() => setReservationDialogOpen(false)}>
                    {reservationLoading ? <LoadingBlock label="Checking provider availability" /> : null}
                    {reservation ? (
                      <Alert dismissible={false} tone={reservation.status === "succeeded" ? "success" : "warning"} title="Reservation response">
                        Reservation {reservation.status}. <Link to="/reservations">Open reservation history</Link>.
                      </Alert>
                    ) : null}
                    {reservationError ? (
                      <Alert dismissible={false} tone="danger" title={reservationError.toLowerCase().includes("timeout") ? "Provider timeout" : "Reservation failed"}>
                        {reservationError}
                      </Alert>
                    ) : null}
                    {!reservationLoading ? (
                      <div className="button-row">
                        {reservationError ? (
                          <Button type="submit">
                            Retry
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </ReservationModal>
                </form>
              ) : (
                <section className="surface reservation-box">
                  <div className="surface-header">
                    <div>
                      <h2>Reservation availability</h2>
                      <p>Reservations are available to EV users. Provider and operator accounts can review point and status information here.</p>
                    </div>
                  </div>
                </section>
              )}
            </section>
          </>
        ) : null}
      </main>
    </AppShell>
  );
}
