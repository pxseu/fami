import { describe, expect, test } from "bun:test";
import {
	FamiError,
	InvalidAttributeError,
	InvalidDateError,
	InvalidNameError,
	InvalidValueError,
} from "../src";

describe("errors", () => {
	test("each error reports its own class name", () => {
		expect(new FamiError("x").name).toBe("FamiError");
		expect(new InvalidNameError("bad").name).toBe("InvalidNameError");
		expect(new InvalidValueError().name).toBe("InvalidValueError");
		expect(new InvalidAttributeError("a", "b").name).toBe(
			"InvalidAttributeError",
		);
		expect(new InvalidDateError().name).toBe("InvalidDateError");
	});

	test("subclasses are still FamiError instances", () => {
		expect(new InvalidNameError("bad")).toBeInstanceOf(FamiError);
		expect(new InvalidValueError()).toBeInstanceOf(FamiError);
		expect(new InvalidAttributeError("a", "b")).toBeInstanceOf(FamiError);
		expect(new InvalidDateError()).toBeInstanceOf(FamiError);
	});
});
