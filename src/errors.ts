export class FamiError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "FamiError";
	}
}

export class InvalidNameError extends FamiError {
	constructor(name?: string) {
		const message = !name
			? "Name is required"
			: `Invalid name: ${name} (must not special characters, separators, or whitespace)`;
		super(message);
	}
}

export class InvalidAttributeError extends FamiError {
	public readonly attribute: string;
	public readonly value: string;
	public readonly validValues?: readonly string[];

	constructor(
		attribute: string,
		value: string,
		validValues?: readonly string[],
	) {
		const message = `Invalid ${attribute} value: ${value}${
			validValues ? `. Must be one of: ${validValues.join(", ")}` : ""
		}`;
		super(message);
		this.attribute = attribute;
		this.value = value;
		this.validValues = validValues;
	}
}

export class InvalidDateError extends FamiError {
	constructor() {
		super("Invalid date; must be a valid Date object");
	}
}
