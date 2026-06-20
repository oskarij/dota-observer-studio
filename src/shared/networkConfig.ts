// Single source of truth for the host + ports the runtime servers bind to (main, event-stream
// endpoint, control UI).
export const NETWORK_HOST = '127.0.0.1';

// Bind address that accepts connections on every interface (loopback + LAN), used when LAN access
// is enabled. Advertised URLs still use the detected LAN IP, since 0.0.0.0 isn't connectable.
export const LAN_BIND_HOST = '0.0.0.0';

export const NETWORK_PORTS = {
  overlayHost: 3333,
  gsiListener: 3334
} as const;

// The SSE route the overlay host (and the packaged web host) expose for the realtime feed; served
// on the page's own origin, so a client connects to `${location.origin}${OVERLAY_EVENTS_PATH}`.
export const OVERLAY_EVENTS_PATH = '/events';

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

// Persisted network settings: the configurable ports plus whether the overlay host and GSI listener
// are exposed to the LAN (default off = loopback only, for an OBS or observer PC separate from the
// app). The web host that serves the studio UI always stays on loopback.
export interface NetworkSettings {
  ports: ConfigurablePorts;
  allowLanAccess: boolean;
}

export const DEFAULT_NETWORK_SETTINGS: NetworkSettings = {
  ports: { ...DEFAULT_CONFIGURABLE_PORTS },
  allowLanAccess: false
};

// Which integration servers couldn't bind their port at startup (port busy). Non-fatal: the app
// still opens, and the UI surfaces it so the user can change the port.
export interface PortConflicts {
  overlayHost: boolean;
  gsiListener: boolean;
}

// What NETWORK_GET_CHANNEL returns: the ports, the LAN toggle, whether a changed toggle needs a
// restart to take effect, the overlay/GSI URLs built from the advertised host, and any port that
// could not be bound.
export interface NetworkInfo {
  ports: ConfigurablePorts;
  allowLanAccess: boolean;
  restartRequired: boolean;
  overlayUrl: string;
  gsiUrl: string;
  portConflicts: PortConflicts;
}

// advertisedHost is the address clients connect to: loopback, or the machine's LAN IP when LAN
// access is active. lanActive is what's bound right now, so a just-changed toggle reads as a
// pending restart rather than an immediate change.
export function buildNetworkInfo(
  settings: NetworkSettings,
  advertisedHost: string,
  lanActive: boolean,
  portConflicts: PortConflicts
): NetworkInfo {
  return {
    ports: settings.ports,
    allowLanAccess: settings.allowLanAccess,
    restartRequired: settings.allowLanAccess !== lanActive,
    overlayUrl: `http://${advertisedHost}:${settings.ports.overlayHost}/overlay/`,
    gsiUrl: `http://${advertisedHost}:${settings.ports.gsiListener}/gsi`,
    portConflicts
  };
}

const MIN_PORT = 1024;
const MAX_PORT = 65535;

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
  }

  if (ports.overlayHost === ports.gsiListener) {
    return {
      field: 'gsiListener',
      message: 'The overlay host and GSI listener must use different ports.'
    };
  }

  return null;
}
