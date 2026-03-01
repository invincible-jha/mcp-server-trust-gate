// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 MuVeraAI Corporation

import { describe, it, expect } from 'vitest';
import { BudgetTracker } from '../src/budget-tracker.js';
import type { BudgetConfig } from '../src/types.js';


function makeDailyTracker(limitAmount: number, currency = 'USD'): BudgetTracker {
  const config: BudgetConfig = { limitAmount, currency, period: 'daily' };
  return new BudgetTracker(config);
}

describe('BudgetTracker', () => {
  describe('recordSpending — within limit', () => {
    it('permits a spend that is exactly the limit', () => {
      const tracker = makeDailyTracker(100);
      const result = tracker.recordSpending(100);
      expect(result.permitted).toBe(true);
      expect(result.remaining).toBe(0);
    });

    it('permits a spend that is below the limit', () => {
      const tracker = makeDailyTracker(50);
      const result = tracker.recordSpending(20);
      expect(result.permitted).toBe(true);
      expect(result.remaining).toBe(30);
    });

    it('reduces remaining budget on successive permitted calls', () => {
      const tracker = makeDailyTracker(100);
      tracker.recordSpending(30);
      const result = tracker.recordSpending(30);
      expect(result.permitted).toBe(true);
      expect(result.remaining).toBe(40);
    });
  });

  describe('recordSpending — exceeds limit', () => {
    it('denies a spend that would exceed the limit', () => {
      const tracker = makeDailyTracker(50);
      tracker.recordSpending(40);
      const result = tracker.recordSpending(20);
      expect(result.permitted).toBe(false);
    });

    it('does not record the amount when the call is denied', () => {
      const tracker = makeDailyTracker(50);
      tracker.recordSpending(40);
      tracker.recordSpending(20); // denied
      const summary = tracker.getSummary();
      expect(summary.spent).toBe(40); // still only the first amount
    });

    it('includes a human-readable reason when the call is denied', () => {
      const tracker = makeDailyTracker(10);
      tracker.recordSpending(9);
      const result = tracker.recordSpending(5);
      expect(result.permitted).toBe(false);
      expect(typeof result.reason).toBe('string');
      expect(result.reason!.length).toBeGreaterThan(0);
    });

    it('reports the remaining budget at the time of denial', () => {
      const tracker = makeDailyTracker(100);
      tracker.recordSpending(70);
      const result = tracker.recordSpending(50);
      expect(result.permitted).toBe(false);
      expect(result.remaining).toBe(30);
    });
  });

  describe('getSummary', () => {
    it('reports zero spent on a fresh tracker', () => {
      const tracker = makeDailyTracker(100);
      const summary = tracker.getSummary();
      expect(summary.spent).toBe(0);
      expect(summary.remaining).toBe(100);
      expect(summary.limit).toBe(100);
    });

    it('reflects cumulative spend correctly', () => {
      const tracker = makeDailyTracker(200);
      tracker.recordSpending(50);
      tracker.recordSpending(75);
      const summary = tracker.getSummary();
      expect(summary.spent).toBe(125);
      expect(summary.remaining).toBe(75);
    });

    it('returns the correct period from config', () => {
      const tracker = new BudgetTracker({ limitAmount: 1000, currency: 'EUR', period: 'monthly' });
      const summary = tracker.getSummary();
      expect(summary.period).toBe('monthly');
    });
  });

  describe('multiple period types', () => {
    it('creates a tracker for hourly period without errors', () => {
      const tracker = new BudgetTracker({ limitAmount: 10, currency: 'USD', period: 'hourly' });
      const result = tracker.recordSpending(5);
      expect(result.permitted).toBe(true);
    });

    it('creates a tracker for weekly period without errors', () => {
      const tracker = new BudgetTracker({ limitAmount: 500, currency: 'USD', period: 'weekly' });
      const result = tracker.recordSpending(100);
      expect(result.permitted).toBe(true);
    });

    it('creates a tracker for monthly period without errors', () => {
      const tracker = new BudgetTracker({ limitAmount: 2000, currency: 'USD', period: 'monthly' });
      const result = tracker.recordSpending(500);
      expect(result.permitted).toBe(true);
      expect(result.remaining).toBe(1500);
    });
  });

  describe('currency', () => {
    it('tracks non-USD currencies without errors', () => {
      const tracker = new BudgetTracker({ limitAmount: 100, currency: 'EUR', period: 'daily' });
      const result = tracker.recordSpending(30);
      expect(result.permitted).toBe(true);
    });
  });
});
