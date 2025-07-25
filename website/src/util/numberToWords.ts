/**
 * Converts a number to words (simplified implementation)
 */
export function numberToWords(num: number): string {
  const ones = [
    "",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
  ];
  const teens = [
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
  ];
  const tens = [
    "",
    "",
    "twenty",
    "thirty",
    "forty",
    "fifty",
    "sixty",
    "seventy",
    "eighty",
    "ninety",
  ];

  if (num === 0) return "zero";
  if (num < 10) return ones[num];
  if (num < 20) return teens[num - 10];
  if (num < 100) {
    const ten = Math.floor(num / 10);
    const one = num % 10;
    return tens[ten] + (one > 0 ? "-" + ones[one] : "");
  }

  // For larger numbers, return the number as string
  return num.toString();
}

/**
 * Converts a number to ordinal words (simplified implementation)
 */
export function numberToOrdinal(num: number): string {
  const words = numberToWords(num);

  // Handle special cases
  if (num === 1) return "first";
  if (num === 2) return "second";
  if (num === 3) return "third";

  // For most numbers, add "th" suffix
  if (num >= 4 && num <= 20) return words + "th";

  // For numbers ending in 1, 2, 3 (but not 11, 12, 13)
  const lastDigit = num % 10;
  const lastTwoDigits = num % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) return words + "th";
  if (lastDigit === 1) return words + "st";
  if (lastDigit === 2) return words + "nd";
  if (lastDigit === 3) return words + "rd";

  return words + "th";
}
