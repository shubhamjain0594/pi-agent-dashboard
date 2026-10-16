const isDebugEnabled = (): boolean => process.env.PI_DASHBOARD_DEBUG === "1";

/** Dashboard extension logger: preserve errors, gate routine diagnostics. */
export const piDashboardConsole = {
  error: (...args: unknown[]) => console.error(...args),
  log: (...args: unknown[]) => {
    if (isDebugEnabled()) console.log(...args);
  },
  info: (...args: unknown[]) => {
    if (isDebugEnabled()) console.info(...args);
  },
  warn: (...args: unknown[]) => {
    if (isDebugEnabled()) console.warn(...args);
  },
};
