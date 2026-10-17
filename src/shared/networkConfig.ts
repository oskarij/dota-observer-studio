import type { OverlayPhase } from './overlayElementCatalog.js';
import { overlayScenePath } from './overlayRoutes.js';

export const NETWORK_HOST = '127.0.0.1';

// Bind address that accepts connections on every interface (loopback + LAN), used when LAN access
// is enabled. Advertised URLs still use the detected LAN IP, since 0.0.0.0 isn't connectable.
export const LAN_BIND_HOST = '0.0.0.0';

export const NETWORK_PORTS = {
  overlayHost: 3333,
  gsiListener: 3334
} as const;

// The SSE route. The overlay host and the packaged web host serve it on the page's own origin.
export const OVERLAY_EVENTS_PATH = '/events';

export interface ConfigurablePorts {
  overlayHost: number;
  gsiListener: number;
}

export const DEFAULT_CONFIGURABLE_PORTS: ConfigurablePorts = {
  overlayHost: NETWORK_PORTS.overlayHost,
  gsiListener: NETWORK_PORTS.gsiListener
};

// allowLanAccess exposes the overlay host and the GSI listener to the LAN. The studio web host
// always stays on loopback.
export interface NetworkSettings {
  ports: ConfigurablePorts;
  allowLanAccess: boolean;
}

export const DEFAULT_NETWORK_SETTINGS: NetworkSettings = {
  ports: { ...DEFAULT_CONFIGURABLE_PORTS },
  allowLanAccess: false
};

// Servers whose port was busy at startup. Non-fatal: the UI shows it so the user can change it.
export interface PortConflicts {
  overlayHost: boolean;
  gsiListener: boolean;
}

export interface NetworkInfo {
  ports: ConfigurablePorts;
  allowLanAccess: boolean;
  restartRequired: boolean;
  // One OBS Browser-source URL per phase: the draft scene and the in-game scene are separate pages.
  overlayUrls: Record<OverlayPhase, string>;
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
  const overlayOrigin = `http://${advertisedHost}:${settings.ports.overlayHost}`;

  return {
    ports: settings.ports,
    allowLanAccess: settings.allowLanAccess,
    restartRequired: settings.allowLanAccess !== lanActive,
    overlayUrls: {
      draft: `${overlayOrigin}${overlayScenePath('draft')}`,
      ingame: `${overlayOrigin}${overlayScenePath('ingame')}`
    },
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

// The first problem found, or null when the ports are safe to bind.
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
