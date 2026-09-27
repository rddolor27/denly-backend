import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  CLASS_NAME_PATTERN,
  MAX_DETECTIONS_PER_RUN,
  MODEL_VERSION_PATTERN,
} from '@/modules/model-registry/constants/model-registry.constants.js';

export class BoundingBoxDTO {
  @ApiProperty({ minimum: 0, maximum: 1 })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1)
  x1!: number;

  @ApiProperty({ minimum: 0, maximum: 1 })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1)
  y1!: number;

  @ApiProperty({ minimum: 0, maximum: 1 })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1)
  x2!: number;

  @ApiProperty({ minimum: 0, maximum: 1 })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1)
  y2!: number;
}

export class ImageSizeDTO {
  @ApiProperty({ minimum: 1, maximum: 20_000 })
  @IsInt()
  @Min(1)
  @Max(20_000)
  w!: number;

  @ApiProperty({ minimum: 1, maximum: 20_000 })
  @IsInt()
  @Min(1)
  @Max(20_000)
  h!: number;
}

export class DetectionDTO {
  @ApiProperty({ minimum: 0, maximum: 9999 })
  @IsInt()
  @Min(0)
  @Max(9999)
  classId!: number;

  @ApiProperty({ pattern: CLASS_NAME_PATTERN.source })
  @IsString()
  @Matches(CLASS_NAME_PATTERN)
  className!: string;

  @ApiProperty({ type: BoundingBoxDTO })
  @ValidateNested()
  @Type(() => BoundingBoxDTO)
  bbox!: BoundingBoxDTO;

  @ApiProperty({ minimum: 0, maximum: 1 })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1)
  confidence!: number;

  // The app's DetectionResult carries it; the registry rejects a run where it differs from the run's.
  @ApiPropertyOptional({ pattern: MODEL_VERSION_PATTERN.source })
  @IsOptional()
  @IsString()
  @Matches(MODEL_VERSION_PATTERN)
  modelVersion?: string;
}

export class SubmitScanDTO {
  @ApiProperty({ pattern: MODEL_VERSION_PATTERN.source })
  @IsString()
  @Matches(MODEL_VERSION_PATTERN)
  modelVersion!: string;

  @ApiProperty({ type: ImageSizeDTO })
  @ValidateNested()
  @Type(() => ImageSizeDTO)
  imageSize!: ImageSizeDTO;

  @ApiProperty({ minimum: 0, maximum: 60_000 })
  @IsInt()
  @Min(0)
  @Max(60_000)
  latencyMs!: number;

  @ApiProperty({ type: [DetectionDTO], maxItems: MAX_DETECTIONS_PER_RUN })
  @IsArray()
  @ArrayMaxSize(MAX_DETECTIONS_PER_RUN)
  @ValidateNested({ each: true })
  @Type(() => DetectionDTO)
  detections!: DetectionDTO[];
}
