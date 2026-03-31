import type { CharacterDef } from '../types';

export const characters: CharacterDef[] = [
  {
    id: 'formula',
    name: 'char_formula',
    maxSpeed: 280,
    acceleration: 200,
    handling: 1.8,
    weight: 0.15,
    brakeForce: 300,
    description: 'Tiny open-wheel racer. Fastest, lightest.',
    primaryColor: '#e02020',
    rivalColor: '#2060e0',
  },
  {
    id: 'yeti',
    name: 'char_yeti',
    maxSpeed: 180,
    acceleration: 100,
    handling: 1.5,
    weight: 0.85,
    brakeForce: 200,
    description: 'Chunky Czech SUV. Slow but heavy.',
    primaryColor: '#e8e8f0',
    rivalColor: '#404050',
  },
  {
    id: 'cat',
    name: 'char_cat',
    maxSpeed: 220,
    acceleration: 160,
    handling: 2.2,
    weight: 0.15,
    brakeForce: 280,
    description: 'Cat on wheels. Best handling, fragile.',
    primaryColor: '#e0a020',
    rivalColor: '#a020e0',
  },
  {
    id: 'pig',
    name: 'char_pig',
    maxSpeed: 260,
    acceleration: 180,
    handling: 1.1,
    weight: 0.75,
    brakeForce: 250,
    description: 'Round pig-mobile. Fast, poor handling.',
    primaryColor: '#e080a0',
    rivalColor: '#80a0e0',
  },
  {
    id: 'frog',
    name: 'char_frog',
    maxSpeed: 230,
    acceleration: 150,
    handling: 1.6,
    weight: 0.45,
    brakeForce: 260,
    description: 'Frog-kart. Balanced all-rounder.',
    primaryColor: '#40c040',
    rivalColor: '#c04040',
  },
];

export function getCharacter(id: string): CharacterDef {
  const char = characters.find((c) => c.id === id);
  if (!char) throw new Error(`Character not found: ${id}`);
  return char;
}
