import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import { MODEL_VERSION_PATTERN } from '../constants/model-registry.constants.js';

export class ModelVersionParamDTO {
  @ApiProperty({
    pattern: MODEL_VERSION_PATTERN.source,
    example: 'yolov8n-ingredients-0.1.0',
  })
  @IsString()
  @Matches(MODEL_VERSION_PATTERN)
  id!: string;
}
