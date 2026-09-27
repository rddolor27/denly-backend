import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '@/commons/auth/public.decorator.js';
import { ErrorResponseDto } from '@/commons/dtos/error-response.dto.js';
import { InjectModelRegistryService } from '../constants/model-registry.constants.js';
import { ModelVersionParamDTO } from '../dtos/model-version-param.dto.js';
import {
  ResponseModelVersionDetailDTO,
  ResponseModelVersionDTO,
} from '../dtos/response-model-version.dto.js';
import type { IModelRegistryService } from '../interfaces/model-registry-service.interface.js';

@Public()
@ApiTags('Model registry')
@Controller('model-versions')
export class ModelRegistryController {
  constructor(
    @InjectModelRegistryService()
    private readonly modelRegistryService: IModelRegistryService,
  ) {}

  @Get()
  @ApiOkResponse({ type: [ResponseModelVersionDTO] })
  async list(): Promise<ResponseModelVersionDTO[]> {
    const versions = await this.modelRegistryService.list();
    return versions.map((version) =>
      ResponseModelVersionDTO.fromModel(version),
    );
  }

  @Get(':id')
  @ApiOkResponse({ type: ResponseModelVersionDetailDTO })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async findOne(
    @Param() params: ModelVersionParamDTO,
  ): Promise<ResponseModelVersionDetailDTO> {
    return ResponseModelVersionDetailDTO.fromModel(
      await this.modelRegistryService.findOne(params.id),
    );
  }
}
