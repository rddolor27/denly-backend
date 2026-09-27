import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '@/commons/auth/public.decorator.js';
import { HealthResponseDto } from './health-response.dto.js';
import { HealthService } from './health.service.js';

// Version-neutral (`/api/health`) because infra probes hit it without a version; public, never throttled.
@Public()
@ApiTags('Health')
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOkResponse({ type: HealthResponseDto })
  async check(): Promise<HealthResponseDto> {
    await this.healthService.checkDatabase();
    return { status: 'ok', db: 'ok', timestamp: new Date().toISOString() };
  }
}
