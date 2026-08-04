/** Min 8 chars, 1 uppercase, 1 number, 1 special character */
export const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export const PASSWORD_RULES_MESSAGE =
  "Password must be at least 8 characters and include an uppercase letter, a number, and a special character";

export function assertValidPassword(password: string) {
  if (!password || !PASSWORD_REGEX.test(password)) {
    throw new Error(PASSWORD_RULES_MESSAGE);
  }
}
