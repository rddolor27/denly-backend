import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '@/commons/auth/authenticated-user.js';
import { CurrentUser } from '@/commons/auth/current-user.decorator.js';
import { ErrorResponseDto } from '@/commons/dtos/error-response.dto.js';
import { InjectScansService } from '../constants/scans.constants.js';
import { ListScansQueryDTO } from '../dtos/list-scans-query.dto.js';
import {
  ResponseScanDTO,
  ResponseScanPageDTO,
} from '../dtos/response-scan.dto.js';
import { SubmitScanDTO } from '../dtos/submit-scan.dto.js';
import type { IScansService } from '../interfaces/scans-service.interface.js';
import { toDetectionRun } from '../models/detection-run.mapper.js';

@ApiTags('Scans')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponseDto })
@Controller('scans')
export class ScansController {
  constructor(
    @InjectScansService() private readonly scansService: IScansService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: ResponseScanDTO })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ErrorResponseDto })
  async submit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitScanDTO,
  ): Promise<ResponseScanDTO> {
    const scan = await this.scansService.submit(user.id, toDetectionRun(dto));
    return ResponseScanDTO.fromModel(scan);
  }

  @Get()
  @ApiOkResponse({ type: ResponseScanPageDTO })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListScansQueryDTO,
  ): Promise<ResponseScanPageDTO> {
    const page = await this.scansService.list(user.id, query.toQuery());
    return ResponseScanPageDTO.fromModel(page);
  }

  @Get(':id')
  @ApiOkResponse({ type: ResponseScanDTO })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ResponseScanDTO> {
    const scan = await this.scansService.findOne(user.id, id);
    return ResponseScanDTO.fromModel(scan);
  }
}
