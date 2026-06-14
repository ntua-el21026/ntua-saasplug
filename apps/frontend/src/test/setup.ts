import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

vi.mock("maplibre-gl", () => {
  type Listener = () => void;

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
    private bounds: MockBounds;
    private zoom: number;

    constructor(options: { container: HTMLElement | string; center?: [number, number]; zoom?: number }) {
      this.container = typeof options.container === "string"
        ? document.getElementById(options.container) as HTMLElement
        : options.container;
      const [lng, lat] = options.center ?? [23.8, 37.98];
      this.zoom = options.zoom ?? 11;
      this.bounds = new MockBounds(lng - 0.22, lat - 0.1, lng + 0.22, lat + 0.1);
    }

    addControl() {
      return this;
    }

    fitBounds(bounds: [[number, number], [number, number]], options?: { maxZoom?: number }) {
      this.bounds = new MockBounds(bounds[0][0], bounds[0][1], bounds[1][0], bounds[1][1]);
      if (options?.maxZoom !== undefined) {
        this.zoom = options.maxZoom;
      }
      this.emit("moveend");
      return this;
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

    off(event: string, listener: Listener) {
      this.listeners.get(event)?.delete(listener);
      return this;
    }

    on(event: string, listener: Listener) {
      const listeners = this.listeners.get(event) ?? new Set<Listener>();
      listeners.add(listener);
      this.listeners.set(event, listeners);
      return this;
    }

    remove() {
      this.container.replaceChildren();
    }

    private emit(event: string) {
      this.listeners.get(event)?.forEach((listener) => listener());
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
