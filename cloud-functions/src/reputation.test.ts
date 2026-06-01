import {calculatePoints} from './reputation';

describe('calculatePoints', () => {
  it('calculates correct weighted points', () => {
    const result = calculatePoints(2, 3, 5);
    expect(result).toBe(31); // 2*10 + 3*2 + 5 = 20 + 6 + 5 = 31
  });

  it('returns 0 when all inputs are 0', () => {
    const result = calculatePoints(0, 0, 0);
    expect(result).toBe(0);
  });
});
