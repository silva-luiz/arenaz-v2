import { describe, expect, it } from 'vitest';
import { slugify } from '../src/venues/slug.js';

describe('slugify', () => {
  it('remove acentos e põe em minúsculas', () => {
    expect(slugify('Arena São João')).toBe('arena-sao-joao');
    expect(slugify('Praça da Ação')).toBe('praca-da-acao');
  });

  it('troca pontuação e espaços por hífen', () => {
    expect(slugify('Quadra do Zé & Cia. (Vila Mariana)!')).toBe(
      'quadra-do-ze-cia-vila-mariana',
    );
  });

  it('colapsa hífens repetidos e apara as pontas', () => {
    expect(slugify('  --Arena --- Central--  ')).toBe('arena-central');
  });

  it('mantém dígitos', () => {
    expect(slugify('Arena 7x7')).toBe('arena-7x7');
  });

  it('limita a 60 caracteres sem terminar em hífen', () => {
    const slug = slugify(`${'a'.repeat(59)} bbbb`);
    expect(slug).toHaveLength(59);
    expect(slug.endsWith('-')).toBe(false);
    expect(slugify('x'.repeat(100))).toHaveLength(60);
  });

  it('resultado vazio vira "espaco"', () => {
    expect(slugify('!!!')).toBe('espaco');
    expect(slugify('   ')).toBe('espaco');
    expect(slugify('日本')).toBe('espaco');
  });
});
