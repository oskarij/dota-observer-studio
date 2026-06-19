// Single source of truth for the loopback host + ports the runtime servers bind to (main,
// event-stream endpoint, control UI).
export const NETWORK_HOST = '127.0.0.1';

export const NETWORK_PORTS = {
  overlayHost: 3333,
  gsiListener: 3334,
  overlayEventStream: 3335
} as const;

// The user-configurable ports. The event-stream port is intentionally absent: it is internal
// plumbing baked into the overlay bundle that the user never types anywhere, so it stays fixed.
export interface ConfigurablePorts {
  overlayHost: number;
  gsiListener: number;
}

export const DEFAULT_CONFIGURABLE_PORTS: ConfigurablePorts = {
  overlayHost: NETWORK_PORTS.overlayHost,
  gsiListener: NETWORK_PORTS.gsiListener
};

// What NETWORK_GET_CHANNEL returns: the effective ports plus the URLs derived from them, so the
// renderer doesn't have to reconstruct them (and the OBS/GSI URLs stay defined in one place).
export interface NetworkInfo {
  ports: ConfigurablePorts;
  overlayUrl: string;
  gsiUrl: string;
}

export function buildNetworkInfo(ports: ConfigurablePorts): NetworkInfo {
  return {
    ports,
    overlayUrl: `http://${NETWORK_HOST}:${ports.overlayHost}/overlay/`,
    gsiUrl: `http://${NETWORK_HOST}:${ports.gsiListener}/gsi`
  };
}

const MIN_PORT = 1024;
const MAX_PORT = 65535;

// Derived (not hardcoded) so the reserved set stays correct if NETWORK_PORTS changes.
const RESERVED_PORTS = [NETWORK_PORTS.overlayEventStream] as const;

export interface PortValidationError {
  field: keyof ConfigurablePorts;
  message: string;
}

// Returns the first problem found, or null when the ports are safe to bind. Both the Settings UI
// (to disable Save) and the main-process store (defensive fallback) call this.
export function validatePorts(ports: ConfigurablePorts): PortValidationError | null {
  const entries: { field: keyof ConfigurablePorts; label: string }[] = [
    { field: 'overlayHost', label: 'Overlay host port' },
    { field: 'gsiListener', label: 'GSI listener port' }
  ];

  for (const { field, label } of entries) {
    const value = ports[field];

    if (!Number.isInteger(value) || value < MIN_PORT || value > MAX_PORT) {
      return {
        field,
        message: `${label} must be a whole number between ${MIN_PORT} and ${MAX_PORT}.`
      };
    }

    if ((RESERVED_PORTS as readonly number[]).includes(value)) {
      return {
        field,
        message: `Port ${value} is reserved by Observer Studio's internal event stream.`
      };
    }
  }

  if (ports.overlayHost === ports.gsiListener) {
    return {
      field: 'gsiListener',
      message: 'The overlay host and GSI listener must use different ports.'
    };
  }

  return null;
}
