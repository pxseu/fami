import {
	FamiError,
	InvalidAttributeError,
	InvalidDateError,
	InvalidNameError,
} from "./errors";
import {
	type CookieDefinition,
	type CookieInit,
	Fami,
	type InferCookieNames,
} from "./fami";
import { parse, serialize } from "./parser";
import type { CookieAttributes, Cookies } from "./types";

export { Fami, type CookieDefinition, type CookieInit, type InferCookieNames };
export { parse, serialize };
export type { CookieAttributes, Cookies };
export {
	InvalidNameError as CookieNameError,
	FamiError,
	InvalidAttributeError,
	InvalidDateError,
};
