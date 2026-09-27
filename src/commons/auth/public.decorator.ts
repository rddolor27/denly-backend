import { type CustomDecorator, SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// Every route requires an access token unless its controller or handler is marked public.
export const Public = (): CustomDecorator => SetMetadata(IS_PUBLIC_KEY, true);
