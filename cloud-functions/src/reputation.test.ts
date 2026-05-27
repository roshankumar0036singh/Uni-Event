describe("calculateReputation logic", () => {
  test("calculates reputation points correctly", () => {
    const attendanceCount = 2;
    const registrationCount = 3;
    const remindersSet = 1;

    const points =
      attendanceCount * 10 +
      registrationCount * 2 +
      remindersSet;

    expect(points).toBe(27);
  });
});

test("calculates zero points correctly", () => {
  const attendanceCount = 0;
  const registrationCount = 0;
  const remindersSet = 0;

  const points =
    attendanceCount * 10 +
    registrationCount * 2 +
    remindersSet;

  expect(points).toBe(0);
});

const { calculatePoints } = require("./reputation");

describe("calculatePoints", () => {
  it("calculates correct weighted points", () => {
    const result = calculatePoints(2, 3, 5);

    expect(result).toBe(2 * 10 + 3 * 2 + 5);
  });

  it("returns 0 when all inputs are 0", () => {
    const result = calculatePoints(0, 0, 0);

    expect(result).toBe(0);
  });
});