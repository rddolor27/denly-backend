import { Inject } from '@nestjs/common';

export const MODEL_REGISTRY_SERVICE = Symbol('MODEL_REGISTRY_SERVICE');
export const InjectModelRegistryService = (): ParameterDecorator =>
  Inject(MODEL_REGISTRY_SERVICE);

export enum ModelVersionStatus {
  SUPPORTED = 'supported',
  RETIRED = 'retired',
}

export const MODEL_VERSION_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;
export const CLASS_NAME_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;
export const MAX_DETECTIONS_PER_RUN = 100;
export const MAX_REPORTED_ISSUES = 20;
