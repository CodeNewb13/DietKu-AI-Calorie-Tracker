/**
 * DEV-ONLY flag. Set by the secret web shortcut in app/_layout.tsx to bypass the
 * onboarding/auth redirect guard so you can preview the main tabs without signing in.
 * Never referenced in production behavior (guards check `__DEV__` too).
 */
export const devSkip = { active: false };
