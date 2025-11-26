import {
	FamiError,
	InvalidAttributeError,
	InvalidDateError,
	InvalidNameError,
} from "./errors";
import { parse, serialize } from "./parser";
import type { CookieAttributes, Cookies } from "./types";

export { parse, serialize };
export type { CookieAttributes, Cookies };
export {
	InvalidNameError as CookieNameError,
	FamiError,
	InvalidAttributeError,
	InvalidDateError,
};
