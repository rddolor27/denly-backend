import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  SCAN_HISTORY_DEFAULT_LIMIT,
  SCAN_HISTORY_MAX_LIMIT,
} from '../constants/scans.constants.js';
import type { ScanHistoryQuery } from '../interfaces/scans-service.interface.js';

export class ListScansQueryDTO {
  @ApiPropertyOptional({
    minimum: 1,
    maximum: SCAN_HISTORY_MAX_LIMIT,
    default: SCAN_HISTORY_DEFAULT_LIMIT,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(SCAN_HISTORY_MAX_LIMIT)
  limit: number = SCAN_HISTORY_DEFAULT_LIMIT;

  @ApiPropertyOptional({ description: '`nextCursor` from the previous page' })
  @IsOptional()
  @MaxLength(200)
  @Matches(/^[A-Za-z0-9_-]+$/)
  cursor?: string;

  toQuery(): ScanHistoryQuery {
    return { limit: this.limit, cursor: this.cursor ?? null };
  }
}
