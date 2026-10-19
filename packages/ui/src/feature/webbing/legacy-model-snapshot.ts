import { z } from 'zod';

/**
 * Retired Choose Life model details, frozen on the webbing by the database
 * (`webbing.legacy_model_snapshot`). The app never writes it. Absent keys
 * mean the old model had no value.
 */
export const legacyModelSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  source: z.literal('chooselife'),
  modelId: z.number().int().positive(),
  name: z.string().trim().min(1),
  material: z.string().min(1).optional(),
  weave: z.string().min(1).optional(),
  strengthClass: z.string().min(1).optional(),
  recommendedLifetimeDays: z.number().int().positive().optional(),
  imagePath: z.string().min(1).optional(),
  capturedAt: z.string(),
  capturedBy: z.enum(['backfill', 'legacy-client']),
});

export type LegacyModelSnapshot = z.infer<typeof legacyModelSnapshotSchema>;

/** Never throws: unknown versions and invalid values read as null. */
export function parseLegacyModelSnapshot(value: unknown): LegacyModelSnapshot | null {
  const result = legacyModelSnapshotSchema.safeParse(value);
  return result.success ? result.data : null;
}
