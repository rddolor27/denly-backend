import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { DatabaseUnavailableError } from '@/commons/errors/database-unavailable.error.js';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Pings the database with a trivial query; throws a typed error rather than leaking the driver's message. */
  async checkDatabase(): Promise<void> {
    try {
      await this.dataSource.query('SELECT 1');
    } catch (error) {
      this.logger.warn(
        `[checkDatabase] ping failed: ${(error as Error).message}`,
      );
      throw new DatabaseUnavailableError();
    }
  }
}
