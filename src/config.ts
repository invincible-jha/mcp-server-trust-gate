// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 MuVeraAI Corporation

import { z } from 'zod';
import { TrustLevel } from '@aumos/types';
import type { TrustGateConfig } from './types.js';

/**
 * Zod schema for {@link TrustGateConfig}.
 *
 * @remarks
 * The `onDeny` callback is intentionally excluded from schema validation
 * because Zod does not validate function shapes at runtime. It is applied
 * after parsing in {@link createConfig}.
 *
 * All fields carry Zod defaults so that callers can supply a minimal config
 * object and receive a fully-populated validated result.
 */
export const TrustGateConfigSchema = z.object({
  defaultTrustLevel: z.nativeEnum(TrustLevel).default(TrustLevel.L0_OBSERVER),

  toolTrustRequirements: z
    .record(z.string(), z.nativeEnum(TrustLevel))
    .default({}),

  budgetConfig: z
    .object({
      limitAmount: z.number().positive(),
      currency: z.string().default('USD'),
      period: z
        .enum(['hourly', 'daily', 'weekly', 'monthly'])
        .default('daily'),
    })
    .optional(),

  auditEnabled: z.boolean().default(true),
});

/**
 * The inferred output type produced by {@link TrustGateConfigSchema}.
 *
 * @remarks
 * This is narrower than {@link TrustGateConfig} because the `onDeny`
 * callback is not part of the schema output — it is merged in by
 * {@link createConfig} after parsing.
 */
export type ParsedTrustGateConfig = z.output<typeof TrustGateConfigSchema>;

/**
 * Validate and construct a {@link TrustGateConfig} from an unknown input.
 *
 * @param input - Raw configuration object. May be partial; Zod defaults fill
 *   in missing optional fields.
 * @returns A fully-validated, immutable {@link TrustGateConfig}.
 * @throws {ZodError} When `input` fails schema validation.
 *
 * @example
 * ```typescript
 * const config = createConfig({
 *   defaultTrustLevel: TrustLevel.L2_SUGGEST,
 *   toolTrustRequirements: { 'send-email': TrustLevel.L3_ACT_APPROVE },
 *   auditEnabled: true,
 * });
 * ```
 */
export function createConfig(
  input: unknown,
  onDeny?: TrustGateConfig['onDeny'],
): TrustGateConfig {
  const parsed = TrustGateConfigSchema.parse(input) as ParsedTrustGateConfig;

  return {
    ...parsed,
    onDeny,
  } as TrustGateConfig;
}
