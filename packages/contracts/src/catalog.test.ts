import { describe, expect, it } from 'vitest';
import {
  AMENITIES,
  AMENITY_LABELS,
  CANCELLATION_POLICIES,
  CANCELLATION_POLICY_DESCRIPTIONS,
  CANCELLATION_POLICY_LABELS,
  FIELD_FORMATS,
  SPORTS,
  SPORT_LABELS,
  SURFACES,
  SURFACE_LABELS,
  UF,
  WEEKDAY_LABELS,
} from './catalog.js';

describe('catalog', () => {
  it('tem rótulo para cada esporte, piso, comodidade e política', () => {
    for (const sport of SPORTS) expect(SPORT_LABELS[sport]).toBeTruthy();
    for (const surface of SURFACES)
      expect(SURFACE_LABELS[surface]).toBeTruthy();
    for (const amenity of AMENITIES)
      expect(AMENITY_LABELS[amenity]).toBeTruthy();
    for (const policy of CANCELLATION_POLICIES) {
      expect(CANCELLATION_POLICY_LABELS[policy]).toBeTruthy();
      expect(CANCELLATION_POLICY_DESCRIPTIONS[policy]).toBeTruthy();
    }
  });

  it('usa os rótulos esperados', () => {
    expect(SPORT_LABELS.futebol_society).toBe('Society');
    expect(SPORT_LABELS.futevolei).toBe('Futevôlei');
    expect(SPORT_LABELS.tenis).toBe('Tênis');
    expect(CANCELLATION_POLICY_DESCRIPTIONS.flexivel).toBe(
      'Reembolso total até 24h antes',
    );
    expect(CANCELLATION_POLICY_DESCRIPTIONS.moderada).toBe(
      'Reembolso total até 48h antes',
    );
    expect(CANCELLATION_POLICY_DESCRIPTIONS.rigida).toBe(
      'Reembolso de 50% até 7 dias antes',
    );
  });

  it('tem 27 UFs únicas, 7 dias da semana e formatos', () => {
    expect(UF).toHaveLength(27);
    expect(new Set(UF).size).toBe(27);
    expect(WEEKDAY_LABELS).toHaveLength(7);
    expect(WEEKDAY_LABELS[0]).toBe('Domingo');
    expect(WEEKDAY_LABELS[6]).toBe('Sábado');
    expect(FIELD_FORMATS).toEqual(['5x5', '6x6', '7x7', '8x8', '11x11']);
  });
});
