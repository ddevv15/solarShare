const unsignedDecimalPattern = /^(0|[1-9][0-9]*)(?:\.([0-9]+))?$/;

type ParsedDecimal = {
  coefficient: bigint;
  scale: number;
};

function parseUnsignedDecimal(value: string): ParsedDecimal {
  const match = unsignedDecimalPattern.exec(value);
  if (!match) throw new Error("Expected an unsigned decimal string.");

  const fraction = match[2] ?? "";
  return {
    coefficient: BigInt(`${match[1]}${fraction}`),
    scale: fraction.length,
  };
}

function powerOfTen(exponent: number): bigint {
  return BigInt(`1${"0".repeat(exponent)}`);
}

function formatDecimal({ coefficient, scale }: ParsedDecimal): string {
  if (coefficient === BigInt(0)) return "0";

  let digits = coefficient.toString();
  if (scale === 0) return digits;

  digits = digits.padStart(scale + 1, "0");
  const whole = digits.slice(0, -scale);
  const fraction = digits.slice(-scale).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

function alignDecimals(
  left: ParsedDecimal,
  right: ParsedDecimal,
): [bigint, bigint, number] {
  const scale = Math.max(left.scale, right.scale);
  return [
    left.coefficient * powerOfTen(scale - left.scale),
    right.coefficient * powerOfTen(scale - right.scale),
    scale,
  ];
}

export function normalizeDecimalString(value: string): string {
  return formatDecimal(parseUnsignedDecimal(value));
}

export function compareDecimalStrings(left: string, right: string): number {
  const [leftCoefficient, rightCoefficient] = alignDecimals(
    parseUnsignedDecimal(left),
    parseUnsignedDecimal(right),
  );
  if (leftCoefficient === rightCoefficient) return 0;
  return leftCoefficient < rightCoefficient ? -1 : 1;
}

export function multiplyDecimalStrings(left: string, right: string): string {
  const leftDecimal = parseUnsignedDecimal(left);
  const rightDecimal = parseUnsignedDecimal(right);
  return formatDecimal({
    coefficient: leftDecimal.coefficient * rightDecimal.coefficient,
    scale: leftDecimal.scale + rightDecimal.scale,
  });
}

export function subtractDecimalStrings(left: string, right: string): string {
  const [leftCoefficient, rightCoefficient, scale] = alignDecimals(
    parseUnsignedDecimal(left),
    parseUnsignedDecimal(right),
  );
  if (leftCoefficient < rightCoefficient) {
    throw new Error("Decimal subtraction would produce a negative value.");
  }
  return formatDecimal({
    coefficient: leftCoefficient - rightCoefficient,
    scale,
  });
}

export function estimateReservation(
  quantityKwh: string,
  maximumPrice: string,
  retailRate: string,
): { estimatedCost: string; estimatedSaving: string } {
  const estimatedCost = multiplyDecimalStrings(quantityKwh, maximumPrice);
  const savingPerKwh =
    compareDecimalStrings(retailRate, maximumPrice) > 0
      ? subtractDecimalStrings(retailRate, maximumPrice)
      : "0";

  return {
    estimatedCost,
    estimatedSaving: multiplyDecimalStrings(quantityKwh, savingPerKwh),
  };
}
