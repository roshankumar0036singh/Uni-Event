export interface FraudResult {
  fraudScore: number;
  reasons: string[];
}

export function createFraudResult(): FraudResult {
  return {
    fraudScore: 0,
    reasons: [],
  };
}