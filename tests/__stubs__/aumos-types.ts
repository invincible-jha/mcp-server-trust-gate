// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 MuVeraAI Corporation
//
// Test stub for @aumos/types — mirrors the real enum values so tests run
// without requiring a built copy of the aumos-core monorepo.

export enum TrustLevel {
  L0_OBSERVER = 0,
  L1_MONITOR = 1,
  L2_SUGGEST = 2,
  L3_ACT_APPROVE = 3,
  L4_ACT_REPORT = 4,
  L5_AUTONOMOUS = 5,
}

export const TRUST_LEVEL_NAMES: Record<TrustLevel, string> = {
  [TrustLevel.L0_OBSERVER]: 'Observer',
  [TrustLevel.L1_MONITOR]: 'Monitor',
  [TrustLevel.L2_SUGGEST]: 'Suggest',
  [TrustLevel.L3_ACT_APPROVE]: 'Act-with-Approval',
  [TrustLevel.L4_ACT_REPORT]: 'Act-and-Report',
  [TrustLevel.L5_AUTONOMOUS]: 'Autonomous',
};
