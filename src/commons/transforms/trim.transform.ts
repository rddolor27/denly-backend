import { Transform } from 'class-transformer';

// Runs before validation, so `@IsEmail()` sees the value the service will store.
export const Trim = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );
