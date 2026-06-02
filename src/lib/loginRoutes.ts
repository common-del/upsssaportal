export const LOGIN_PATH = '/login';

export const LOGIN_TABS = {
  official: `${LOGIN_PATH}?tab=official`,
  school: `${LOGIN_PATH}?tab=school`,
  verifier: `${LOGIN_PATH}?tab=verifier`,
} as const;
