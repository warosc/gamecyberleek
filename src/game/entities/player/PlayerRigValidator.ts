import { PLAYER_RIG_LAYERS, PLAYER_RIG_STATES, type PlayerRigAssetManifest } from './PlayerRigManifest';

export interface PlayerRigValidation {
  valid: boolean;
  errors: string[];
}

export function validatePlayerRig(manifest: {
  version?: number;
  layers?: Partial<PlayerRigAssetManifest['layers']>;
  animations?: Partial<NonNullable<PlayerRigAssetManifest['animations']>>;
} | undefined): PlayerRigValidation {
  const errors: string[] = [];
  if (!manifest) return { valid: false, errors: ['manifest is missing'] };
  if (manifest.version !== 1) errors.push('unsupported manifest version');
  for (const layer of PLAYER_RIG_LAYERS) {
    const path = manifest.layers?.[layer];
    if (typeof path !== 'string' || path.length === 0) errors.push(`missing layer: ${layer}`);
  }
  for (const state of PLAYER_RIG_STATES) {
    const path = manifest.animations?.[state];
    if (typeof path !== 'string' || path.length === 0) errors.push(`missing animation: ${state}`);
  }
  return { valid: errors.length === 0, errors };
}
