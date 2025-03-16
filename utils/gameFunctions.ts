import { generateRandomNumberInRange } from "./numberGenerator";

export const rollDice = () => {
  return {
    left: generateRandomNumberInRange(1, 6),
    right: generateRandomNumberInRange(1, 6),
  };
};
