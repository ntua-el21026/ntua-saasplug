import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

vi.mock("maplibre-gl", () => {
  type Listener = () => void;
  const BASE_HALF_LAT_AT_ZOOM_15 = 0.0073;

  class MockBounds {
    constructor(
      private readonly west: number,
      private readonly south: number,
      private readonly east: number,
      private readonly north: number,
    ) {}

    getWest() {
      return this.west;
    }

    getSouth() {
      return this.south;
    }

    getEast() {
      return this.east;
    }

    getNorth() {
      return this.north;
    }
  }

  class MockMap {
    private readonly container: HTMLElement;
    private readonly listeners = new Map<string, Set<Listener>>();
    private readonly sources = new Map<string, { data?: unknown; setData: (data: unknown) => void }>();
    private bounds: MockBounds;
    private center: { lng: number; lat: number };
    private zoom: number;
    private readonly handleTestPan = (event: Event) => {
      const detail = (event as CustomEvent<{ latDelta?: number; lngDelta?: number }>).detail ?? {};
      this.center = {
        lng: this.center.lng + (detail.lngDelta ?? 0),
        lat: this.center.lat + (detail.latDelta ?? 0),
      };
      this.bounds = this.boundsForCurrentView();
      this.emit("moveend");
    };
    private readonly handleTestCamera = (event: Event) => {
      const detail = (event as CustomEvent<{
        center?: { lat: number; lng: number };
        latDelta?: number;
        lngDelta?: number;
        zoom?: number;
      }>).detail ?? {};
      this.center = detail.center
        ? { lat: detail.center.lat, lng: detail.center.lng }
        : {
            lng: this.center.lng + (detail.lngDelta ?? 0),
            lat: this.center.lat + (detail.latDelta ?? 0),
          };
      if (detail.zoom !== undefined) {
        this.zoom = detail.zoom;
      }
      this.bounds = this.boundsForCurrentView();
      this.emit("moveend");
    };

    constructor(options: { container: HTMLElement | string; center?: [number, number]; zoom?: number }) {
      this.container = typeof options.container === "string"
        ? document.getElementById(options.container) as HTMLElement
        : options.container;
      const [lng, lat] = options.center ?? [23.8, 37.98];
      Object.defineProperty(this.container, "clientWidth", { configurable: true, value: 960 });
      Object.defineProperty(this.container, "clientHeight", { configurable: true, value: 620 });
      this.center = { lng, lat };
      this.zoom = options.zoom ?? 11;
      this.bounds = this.boundsForCurrentView();
      this.container.addEventListener("saasplug:test-pan", this.handleTestPan);
      this.container.addEventListener("saasplug:test-camera", this.handleTestCamera);
    }

    addControl(control: unknown, position: string = "top-right") {
      if (control instanceof MockNavigationControl) {
        this.addNavigationControls(position);
      }
      return this;
    }

    fitBounds(bounds: [[number, number], [number, number]], options?: { maxZoom?: number }) {
      this.bounds = new MockBounds(bounds[0][0], bounds[0][1], bounds[1][0], bounds[1][1]);
      this.center = {
        lng: (bounds[0][0] + bounds[1][0]) / 2,
        lat: (bounds[0][1] + bounds[1][1]) / 2,
      };
      if (options?.maxZoom !== undefined) {
        this.zoom = options.maxZoom;
      }
      this.emit("moveend");
      return this;
    }

    getCenter() {
      return this.center;
    }

    getBounds() {
      return this.bounds;
    }

    getContainer() {
      return this.container;
    }

    getZoom() {
      return this.zoom;
    }

    jumpTo(options: { center?: [number, number]; zoom?: number }) {
      if (options.center) {
        this.center = { lng: options.center[0], lat: options.center[1] };
      }
      if (options.zoom !== undefined) {
        this.zoom = options.zoom;
      }
      this.bounds = this.boundsForCurrentView();
      this.emit("moveend");
      return this;
    }

    project(lngLat: { lng: number; lat: number }) {
      const pixelsPerDegree = 4_000 * 2 ** (this.zoom - 13);
      return {
        x: lngLat.lng * pixelsPerDegree,
        y: lngLat.lat * pixelsPerDegree,
      };
    }

    unproject(point: [number, number]) {
      const pixelsPerDegree = 4_000 * 2 ** (this.zoom - 13);
      return {
        lng: point[0] / pixelsPerDegree,
        lat: point[1] / pixelsPerDegree,
      };
    }

    addLayer() {
      return this;
    }

    addSource(id: string, source: { data?: unknown }) {
      const sourceState: { data?: unknown; setData: (data: unknown) => void } = {
        data: source.data,
        setData: (data: unknown) => {
          sourceState.data = data;
          this.container.setAttribute(`data-source-${id}`, JSON.stringify(data));
        },
      };
      this.sources.set(id, sourceState);
      this.container.setAttribute(`data-source-${id}`, JSON.stringify(source.data));
      return this;
    }

    getSource(id: string) {
      return this.sources.get(id);
    }

    off(event: string, listener: Listener) {
      this.listeners.get(event)?.delete(listener);
      return this;
    }

    on(event: string, listener: Listener) {
      const listeners = this.listeners.get(event) ?? new Set<Listener>();
      listeners.add(listener);
      this.listeners.set(event, listeners);
      if (event === "load") {
        queueMicrotask(listener);
      }
      return this;
    }

    remove() {
      this.container.removeEventListener("saasplug:test-pan", this.handleTestPan);
      this.container.removeEventListener("saasplug:test-camera", this.handleTestCamera);
      this.container.replaceChildren();
    }

    resize() {
      this.bounds = this.boundsForCurrentView();
      return this;
    }

    private addNavigationControls(position: string) {
      const corner = document.createElement("div");
      corner.className = `maplibregl-ctrl-${position}`;

      const group = document.createElement("div");
      group.className = "maplibregl-ctrl maplibregl-ctrl-group";

      const zoomIn = document.createElement("button");
      zoomIn.type = "button";
      zoomIn.setAttribute("aria-label", "Zoom in");
      zoomIn.textContent = "+";
      zoomIn.addEventListener("click", () => this.changeZoom(1));

      const zoomOut = document.createElement("button");
      zoomOut.type = "button";
      zoomOut.setAttribute("aria-label", "Zoom out");
      zoomOut.textContent = "-";
      zoomOut.addEventListener("click", () => this.changeZoom(-1));

      group.append(zoomIn, zoomOut);
      corner.append(group);
      this.container.appendChild(corner);
    }

    private changeZoom(delta: number) {
      this.zoom += delta;
      this.bounds = this.boundsForCurrentView();
      this.emit("moveend");
    }

    private emit(event: string) {
      this.listeners.get(event)?.forEach((listener) => listener());
    }

    private boundsForCurrentView() {
      const scale = 2 ** (15 - this.zoom);
      const halfLat = BASE_HALF_LAT_AT_ZOOM_15 * scale;
      const aspectRatio = this.container.clientWidth / this.container.clientHeight;
      const halfLng = halfLat * aspectRatio / Math.max(0.2, Math.cos(this.center.lat * Math.PI / 180));
      return new MockBounds(
        this.center.lng - halfLng,
        this.center.lat - halfLat,
        this.center.lng + halfLng,
        this.center.lat + halfLat,
      );
    }
  }

  class MockMarker {
    constructor(private readonly options: { element: HTMLElement }) {}

    setLngLat() {
      return this;
    }

    addTo(map: MockMap) {
      map.getContainer().appendChild(this.options.element);
      return this;
    }

    remove() {
      this.options.element.remove();
    }
  }

  class MockNavigationControl {}
  class MockScaleControl {}

  const mocked = {
    Map: MockMap,
    Marker: MockMarker,
    NavigationControl: MockNavigationControl,
    ScaleControl: MockScaleControl,
  };

  return {
    ...mocked,
    default: mocked,
  };
});
