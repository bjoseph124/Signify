import { describe, expect, it } from 'vitest';
import fixtures from './python-fixtures.json';
import { classify, NO_HAND, Smoother, UNKNOWN, type Point } from './classifier';
import { cameraError } from './useCamera';

describe('Python classifier parity', () => {
  for (const fixture of fixtures) it(fixture.name, () => expect(classify(fixture.points as Point[])).toBe(fixture.expected));
  it('rejects nonfinite points', () => expect(classify(Array.from({length:21},()=>[NaN,0,0] as Point))).toBe(UNKNOWN));
});
describe('prediction lifecycle', () => {
  it('requires six frames, clears on loss, and never uses old votes after reacquisition', () => {
    const s = new Smoother();
    for (let i=0;i<5;i++) expect(s.update('L')).toBe(UNKNOWN);
    expect(s.update('L')).toBe('L');
    expect(s.update(null)).toBe(NO_HAND);
    expect(s.update('L')).toBe(UNKNOWN);
  });
  it('expires unknown and rejects alternating noise', () => {
    const s = new Smoother();
    for (let i=0;i<8;i++) s.update('L');
    expect(s.update(UNKNOWN)).toBe('L'); s.update(UNKNOWN);
    expect(s.update(UNKNOWN)).toBe(UNKNOWN);
    for (let i=0;i<30;i++) expect(s.update(i%2 ? 'L':'V')).toBe(UNKNOWN);
  });
  it('does not display a previous letter while acquiring a new one', () => {
    const s = new Smoother(); for(let i=0;i<8;i++) s.update('L');
    expect(s.update('V')).toBe(UNKNOWN);
    for(let i=0;i<7;i++) s.update('V');
    expect(s.update('V')).toBe('V');
  });
  it('explains permission and device failures', () => {
    expect(cameraError(new DOMException('', 'NotAllowedError'))).toContain('permission was denied');
    expect(cameraError(new DOMException('', 'NotFoundError'))).toContain('No camera found');
  });
});
