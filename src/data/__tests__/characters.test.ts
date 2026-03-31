import { describe, it, expect } from 'vitest';
import { characters, getCharacter } from '../characters';
import type { CharacterDef } from '../../types';

describe('characters data', () => {
  it('contains exactly 6 characters', () => {
    expect(characters).toHaveLength(6);
  });

  it('has formula character', () => {
    const formula = characters.find(c => c.id === 'formula');
    expect(formula).toBeDefined();
    expect(formula!.name).toBe('char_formula');
  });

  it('has yeti character', () => {
    const yeti = characters.find(c => c.id === 'yeti');
    expect(yeti).toBeDefined();
    expect(yeti!.name).toBe('char_yeti');
  });

  it('has cat character', () => {
    const cat = characters.find(c => c.id === 'cat');
    expect(cat).toBeDefined();
    expect(cat!.name).toBe('char_cat');
  });

  it('has pig character', () => {
    const pig = characters.find(c => c.id === 'pig');
    expect(pig).toBeDefined();
    expect(pig!.name).toBe('char_pig');
  });

  it('has frog character', () => {
    const frog = characters.find(c => c.id === 'frog');
    expect(frog).toBeDefined();
    expect(frog!.name).toBe('char_frog');
  });

  it('all characters have unique IDs', () => {
    const ids = characters.map(c => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(characters.length);
  });

  it('all characters have positive maxSpeed', () => {
    for (const char of characters) {
      expect(char.maxSpeed).toBeGreaterThan(0);
    }
  });

  it('all characters have positive acceleration', () => {
    for (const char of characters) {
      expect(char.acceleration).toBeGreaterThan(0);
    }
  });

  it('all characters have positive handling', () => {
    for (const char of characters) {
      expect(char.handling).toBeGreaterThan(0);
    }
  });

  it('all characters have weight between 0 and 1', () => {
    for (const char of characters) {
      expect(char.weight).toBeGreaterThanOrEqual(0);
      expect(char.weight).toBeLessThanOrEqual(1);
    }
  });

  it('all characters have positive brakeForce', () => {
    for (const char of characters) {
      expect(char.brakeForce).toBeGreaterThan(0);
    }
  });

  it('all characters have non-empty description', () => {
    for (const char of characters) {
      expect(char.description.length).toBeGreaterThan(0);
    }
  });

  it('all characters have primary and rival colors', () => {
    for (const char of characters) {
      expect(char.primaryColor).toMatch(/^#[0-9a-f]{6}$/i);
      expect(char.rivalColor).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('formula is the fastest (highest maxSpeed)', () => {
    const formula = characters.find(c => c.id === 'formula')!;
    for (const char of characters) {
      expect(formula.maxSpeed).toBeGreaterThanOrEqual(char.maxSpeed);
    }
  });

  it('yeti is the heaviest (highest weight)', () => {
    const yeti = characters.find(c => c.id === 'yeti')!;
    for (const char of characters) {
      expect(yeti.weight).toBeGreaterThanOrEqual(char.weight);
    }
  });

  it('cat has the best handling', () => {
    const cat = characters.find(c => c.id === 'cat')!;
    for (const char of characters) {
      expect(cat.handling).toBeGreaterThanOrEqual(char.handling);
    }
  });
});

describe('getCharacter', () => {
  it('returns correct data for formula', () => {
    const char = getCharacter('formula');
    expect(char.id).toBe('formula');
    expect(char.maxSpeed).toBe(280);
    expect(char.acceleration).toBe(200);
    expect(char.handling).toBe(1.8);
    expect(char.weight).toBe(0.15);
    expect(char.brakeForce).toBe(300);
  });

  it('returns correct data for yeti', () => {
    const char = getCharacter('yeti');
    expect(char.id).toBe('yeti');
    expect(char.maxSpeed).toBe(180);
    expect(char.acceleration).toBe(100);
  });

  it('returns correct data for cat', () => {
    const char = getCharacter('cat');
    expect(char.id).toBe('cat');
    expect(char.handling).toBe(2.2);
  });

  it('returns correct data for pig', () => {
    const char = getCharacter('pig');
    expect(char.id).toBe('pig');
    expect(char.maxSpeed).toBe(260);
  });

  it('returns correct data for frog', () => {
    const char = getCharacter('frog');
    expect(char.id).toBe('frog');
    expect(char.maxSpeed).toBe(230);
    expect(char.handling).toBe(1.6);
  });

  it('throws for unknown character ID', () => {
    expect(() => getCharacter('unknown')).toThrow('Character not found: unknown');
  });

  it('throws for empty string', () => {
    expect(() => getCharacter('')).toThrow('Character not found: ');
  });

  it('is case-sensitive', () => {
    expect(() => getCharacter('Formula')).toThrow('Character not found: Formula');
  });

  it('returns a CharacterDef with all required fields', () => {
    const char = getCharacter('formula');
    expect(char).toHaveProperty('id');
    expect(char).toHaveProperty('name');
    expect(char).toHaveProperty('maxSpeed');
    expect(char).toHaveProperty('acceleration');
    expect(char).toHaveProperty('handling');
    expect(char).toHaveProperty('weight');
    expect(char).toHaveProperty('brakeForce');
    expect(char).toHaveProperty('description');
    expect(char).toHaveProperty('primaryColor');
    expect(char).toHaveProperty('rivalColor');
  });
});
