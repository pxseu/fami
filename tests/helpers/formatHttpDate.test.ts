import { describe, expect, test } from "bun:test";
import { InvalidDateError } from "../../src/errors";
import { formatHttpDate } from "../../src/helpers";

describe("formatHttpDate", () => {
	describe("valid dates", () => {
		test("formats valid date correctly", () => {
			const date = new Date("Wed, 09 Jun 2021 10:18:14 GMT");
			expect(formatHttpDate(date)).toBe("Wed, 09 Jun 2021 10:18:14 GMT");
		});
	});

	describe("error handling", () => {
		test("throws InvalidDateError for invalid date", () => {
			expect(() => formatHttpDate(new Date("invalid"))).toThrow(
				InvalidDateError,
			);
		});

		test("throws InvalidDateError for null", () => {
			// @ts-expect-error
			expect(() => formatHttpDate(null)).toThrow(InvalidDateError);
		});

		test("throws InvalidDateError for undefined", () => {
			// @ts-expect-error
			expect(() => formatHttpDate(undefined)).toThrow(InvalidDateError);
		});

		test("throws InvalidDateError for non-Date object", () => {
			// @ts-expect-error
			expect(() => formatHttpDate("2021-01-01")).toThrow(InvalidDateError);
		});
	});
});
