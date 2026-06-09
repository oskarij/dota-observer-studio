import type { DotaGsiData } from '../../shared/dotaGsiPayload.js';

import gsiSample from './gsiSample.json';

// A captured GSI snapshot (from .dev/gsi_dataset.json) used to populate the overlay
// preview, since the real elements stay hidden without a live feed.
export const SAMPLE_GSI_DATA = gsiSample as unknown as DotaGsiData;
