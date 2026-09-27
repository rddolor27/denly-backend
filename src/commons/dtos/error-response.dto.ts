import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** The one error response shape every endpoint returns (nestjs skill § HTTP layer). */
export class ErrorResponseDto {
  @ApiProperty({ example: 404 })
  statusCode!: number;

  @ApiProperty({
    example: 'SCAN_NOT_FOUND',
    description: 'Stable, UPPER_SNAKE error code',
  })
  code!: string;

  @ApiProperty({ example: 'Scan 3f2f... not found' })
  message!: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  details?: Record<string, unknown>;

  @ApiProperty({ example: '9b1e...-request-id' })
  requestId!: string;

  @ApiProperty({ example: '2026-09-23T10:00:00.000Z' })
  timestamp!: string;
}
