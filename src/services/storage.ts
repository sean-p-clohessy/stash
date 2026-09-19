import { useState } from "react";
export function useStored<T>(
  key: string,
  initial: T,
  validate: (value: unknown) => value is T,
) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(key) ?? "null");
      return validate(raw) ? raw : initial;
    } catch {
      return initial;
    }
  });
  const [error, setError] = useState(false);
  function update(next: T) {
    setValue(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
      setError(false);
    } catch {
      setError(true);
    }
  }
  return [value, update, error] as const;
}
