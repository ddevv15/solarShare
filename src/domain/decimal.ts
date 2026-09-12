const unsignedDecimalPattern = /^(0|[1-9][0-9]*)(?:\.([0-9]+))?$/;

type ParsedDecimal = {
  coefficient: bigint;
  scale: number;
};

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a;
}

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

export function addDecimalStrings(left: string, right: string): string {
  const [leftCoefficient, rightCoefficient, scale] = alignDecimals(
    parseUnsignedDecimal(left),
    parseUnsignedDecimal(right),
  );
  return formatDecimal({
    coefficient: leftCoefficient + rightCoefficient,
    scale,
  });
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
  marketUnitPrice: string,
  maximumPrice: string,
  retailRate: string,
): { estimatedCost: string; estimatedSaving: string } {
  const effectiveUnitPrice =
    compareDecimalStrings(marketUnitPrice, maximumPrice) <= 0
      ? marketUnitPrice
      : maximumPrice;
  const estimatedCost = multiplyDecimalStrings(quantityKwh, effectiveUnitPrice);
  const savingPerKwh =
    compareDecimalStrings(retailRate, effectiveUnitPrice) > 0
      ? subtractDecimalStrings(retailRate, effectiveUnitPrice)
      : "0";

  return {
    estimatedCost,
    estimatedSaving: multiplyDecimalStrings(quantityKwh, savingPerKwh),
  };
}

/**
 * Exact rational arithmetic for domain formulas that include division.
 * Values stay as BigInt fractions until a rule explicitly rounds them.
 */
export class ExactRational {
  readonly numerator: bigint;
  readonly denominator: bigint;

  private constructor(numerator: bigint, denominator: bigint) {
    if (denominator === 0n) throw new Error("Cannot divide by zero.");
    const sign = denominator < 0n ? -1n : 1n;
    const divisor = greatestCommonDivisor(numerator, denominator);
    this.numerator = (numerator * sign) / divisor;
    this.denominator = (denominator * sign) / divisor;
  }

  static fromDecimal(value: string): ExactRational {
    const parsed = parseUnsignedDecimal(value);
    return new ExactRational(parsed.coefficient, powerOfTen(parsed.scale));
  }

  static fromInteger(value: bigint): ExactRational {
    return new ExactRational(value, 1n);
  }

  add(other: ExactRational): ExactRational {
    return new ExactRational(
      this.numerator * other.denominator + other.numerator * this.denominator,
      this.denominator * other.denominator,
    );
  }

  subtract(other: ExactRational): ExactRational {
    return new ExactRational(
      this.numerator * other.denominator - other.numerator * this.denominator,
      this.denominator * other.denominator,
    );
  }

  multiply(other: ExactRational): ExactRational {
    return new ExactRational(
      this.numerator * other.numerator,
      this.denominator * other.denominator,
    );
  }

  divide(other: ExactRational): ExactRational {
    return new ExactRational(
      this.numerator * other.denominator,
      this.denominator * other.numerator,
    );
  }

  compare(other: ExactRational): number {
    const difference =
      this.numerator * other.denominator - other.numerator * this.denominator;
    return difference === 0n ? 0 : difference < 0n ? -1 : 1;
  }

  clamp(lower: ExactRational, upper: ExactRational): ExactRational {
    if (lower.compare(upper) > 0) {
      throw new Error("Decimal clamp lower bound exceeds upper bound.");
    }
    if (this.compare(lower) < 0) return lower;
    if (this.compare(upper) > 0) return upper;
    return this;
  }

  roundToFixed(scale: number): string {
    if (!Number.isSafeInteger(scale) || scale < 0) {
      throw new Error("Decimal scale must be a nonnegative safe integer.");
    }

    const negative = this.numerator < 0n;
    const absoluteNumerator = negative ? -this.numerator : this.numerator;
    const scaledNumerator = absoluteNumerator * powerOfTen(scale);
    let rounded = scaledNumerator / this.denominator;
    const remainder = scaledNumerator % this.denominator;
    if (remainder * 2n >= this.denominator) rounded += 1n;

    let digits = rounded.toString();
    if (scale === 0) return `${negative && rounded !== 0n ? "-" : ""}${digits}`;
    digits = digits.padStart(scale + 1, "0");
    const whole = digits.slice(0, -scale);
    const fraction = digits.slice(-scale);
    return `${negative && rounded !== 0n ? "-" : ""}${whole}.${fraction}`;
  }
}
