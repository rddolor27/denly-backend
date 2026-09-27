import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok' })
  status!: 'ok';

  @ApiProperty({ example: 'ok' })
  db!: 'ok';

  @ApiProperty({ example: '2026-09-23T10:00:00.000Z' })
  timestamp!: string;
}
