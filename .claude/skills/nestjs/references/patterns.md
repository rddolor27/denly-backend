# NestJS templates (denly-backend)

Replace `Scan`/`scans` consistently. Single quotes, trailing commas, explicit return types.

## constants/scans.constants.ts
```ts
export const SCANS_SERVICE = Symbol('SCANS_SERVICE');
export const MAX_DETECTIONS_PER_RUN = 100;
```

## interfaces/scans-service.interface.ts
```ts
export interface IScansService {
  submit(run: DetectionRunInput): Promise<ScanModel>;
  findOne(id: string): Promise<ScanModel>;
  process(id: string): Promise<void>;
}
```

## models/scan.model.ts
```ts
export class ScanModel {
  readonly id!: string;
  readonly status!: ScanStatus;
  readonly ingredients!: readonly StructuredIngredient[];
  readonly analysis!: AnalysisResult | null;
  readonly modelVersion!: string;
  readonly createdAt!: Date;

  static fromEntity(e: Scan): ScanModel {
    return Object.assign(new ScanModel(), {
      id: e.id, status: e.status, ingredients: e.ingredients ?? [], analysis: e.analysis ?? null,
      modelVersion: e.modelVersion, createdAt: e.createdAt,
    });
  }
}
```

## dtos
```ts
// The device's DetectionRun (ADR 0002). Shape checks here; taxonomy checks in the model registry.
export class BBoxDTO {
  @ApiProperty({ minimum: 0, maximum: 1 }) @IsNumber() @Min(0) @Max(1) x1!: number;
  @ApiProperty({ minimum: 0, maximum: 1 }) @IsNumber() @Min(0) @Max(1) y1!: number;
  @ApiProperty({ minimum: 0, maximum: 1 }) @IsNumber() @Min(0) @Max(1) x2!: number;
  @ApiProperty({ minimum: 0, maximum: 1 }) @IsNumber() @Min(0) @Max(1) y2!: number;
}

export class DetectionDTO {
  @ApiProperty({ minimum: 0 }) @IsInt() @Min(0) classId!: number;
  @ApiProperty({ maxLength: 64 }) @IsString() @Matches(/^[a-z0-9_]+$/) @MaxLength(64) className!: string;
  @ApiProperty({ type: BBoxDTO }) @ValidateNested() @Type(() => BBoxDTO) bbox!: BBoxDTO;
  @ApiProperty({ minimum: 0, maximum: 1 }) @IsNumber() @Min(0) @Max(1) confidence!: number;
}

export class SubmitScanDTO {
  @ApiProperty({ maxLength: 64 }) @IsString() @MaxLength(64) modelVersion!: string;
  @ApiProperty({ type: ImageSizeDTO }) @ValidateNested() @Type(() => ImageSizeDTO) imageSize!: ImageSizeDTO;
  @ApiProperty({ minimum: 0 }) @IsInt() @Min(0) @Max(60_000) latencyMs!: number;
  @ApiProperty({ type: [DetectionDTO], maxItems: MAX_DETECTIONS_PER_RUN })
  @IsArray() @ArrayMaxSize(MAX_DETECTIONS_PER_RUN) @ValidateNested({ each: true }) @Type(() => DetectionDTO)
  detections!: DetectionDTO[];
}

export class ScanQuestionDTO {
  @ApiProperty({ maxLength: 500 })
  @IsString() @IsNotEmpty() @MaxLength(500)
  question!: string;
}

export class ResponseScanDTO {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ScanStatus }) status!: ScanStatus;
  @ApiProperty({ type: [ResponseIngredientDTO] }) ingredients!: ResponseIngredientDTO[];
  @ApiPropertyOptional({ type: ResponseAnalysisDTO, nullable: true }) analysis!: ResponseAnalysisDTO | null;

  static fromModel(m: ScanModel): ResponseScanDTO {
    return Object.assign(new ResponseScanDTO(), {
      id: m.id, status: m.status,
      ingredients: m.ingredients.map(ResponseIngredientDTO.fromModel),
      analysis: m.analysis ? ResponseAnalysisDTO.fromModel(m.analysis) : null,
    });
  }
}
```

## Model registry and the LLM port
```ts
// modules/model-registry/interfaces/model-registry-service.interface.ts
// Detection runs on the phone (ADR 0002); the backend only checks what the device reports.
export const MODEL_REGISTRY_SERVICE = Symbol('MODEL_REGISTRY_SERVICE');
export interface IModelRegistryService {
  /** Throws UnsupportedModelVersionError / InvalidDetectionError; resolves when the run is acceptable. */
  assertValidRun(run: DetectionRunInput): Promise<void>;
}
export const InjectModelRegistryService = (): ParameterDecorator => Inject(MODEL_REGISTRY_SERVICE);

// modules/analysis/interfaces/language-model.interface.ts
export const LANGUAGE_MODEL = Symbol('LANGUAGE_MODEL');
export interface ILanguageModel {
  analyze(input: StructuredIngredientData, options?: AnalyzeOptions): Promise<AnalysisResult>;
  readonly promptVersion: string;
}
```
```ts
// analysis.module.ts — one adapter bound per port; swap here, nowhere else
@Module({
  providers: [{ provide: LANGUAGE_MODEL, useClass: ChosenProviderLanguageModel }],
  exports: [LANGUAGE_MODEL],
})
export class AnalysisModule {}
```

## services/scans.service.ts
```ts
@Injectable()
export class ScansService implements IScansService {
  private readonly logger = new Logger(ScansService.name);

  constructor(
    @InjectRepository(Scan) private readonly scansRepository: Repository<Scan>,
    @InjectModelRegistryService() private readonly registry: IModelRegistryService,
    private readonly intelligence: IngredientIntelligenceService,
    @Inject(LANGUAGE_MODEL) private readonly llm: ILanguageModel,
  ) {}

  async submit(run: DetectionRunInput): Promise<ScanModel> {
    await this.registry.assertValidRun(run);             // unknown version / foreign class pair → 422
    const scan = await this.scansRepository.save(this.scansRepository.create({
      status: ScanStatus.QUEUED, modelVersion: run.modelVersion,
      detections: run.detections.map((d) => ({ ...d, source: DetectionSource.DEVICE })),
    }));
    // hand scan.id to process() outside the request — queue vs background job is a scaffold decision
    return ScanModel.fromEntity(scan);
  }

  async findOne(id: string): Promise<ScanModel> {
    const scan = await this.scansRepository.findOne({ where: { id } });
    if (!scan) throw new ScanNotFoundError(id);          // typed domain error with code
    return ScanModel.fromEntity(scan);
  }

  async process(id: string): Promise<void> {
    const scan = await this.scansRepository.findOne({ where: { id }, relations: { detections: true } });
    if (!scan) throw new ScanNotFoundError(id);
    const structured = this.intelligence.build(scan.detections.map(DetectionModel.fromEntity));
    let analysis: AnalysisResult | null = null;
    try {
      analysis = await this.llm.analyze(structured);
    } catch (error) {
      this.logger.warn(`[process] analysis unavailable for ${id}: ${(error as Error).message}`);
    }
    await this.scansRepository.update({ id }, {
      status: ScanStatus.DONE, ingredients: structured.ingredients, analysis,
      rulesVersion: structured.rulesVersion, promptVersion: this.llm.promptVersion,
    });
  }
}

export const InjectScansService = (): ParameterDecorator => Inject(SCANS_SERVICE);
export const ScansProvider: Provider = { provide: SCANS_SERVICE, useClass: ScansService };
```

## controllers/scans.controller.ts
```ts
@ApiTags('Scans')
@Controller('scans')
export class ScansController {
  constructor(@InjectScansService() private readonly scansService: IScansService) {}

  @Post()
  @HttpCode(202)
  @ApiAcceptedResponse({ type: ResponseScanDTO })
  async submit(@Body() dto: SubmitScanDTO): Promise<ResponseScanDTO> {
    return ResponseScanDTO.fromModel(await this.scansService.submit(DetectionRunInput.fromDTO(dto)));
  }

  @Get(':id')
  @ApiOkResponse({ type: ResponseScanDTO })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ResponseScanDTO> {
    return ResponseScanDTO.fromModel(await this.scansService.findOne(id));
  }
}
```

## Domain error + filter mapping
```ts
export class ScanNotFoundError extends DomainError {
  constructor(id: string) { super('SCAN_NOT_FOUND', `Scan ${id} not found`, HttpStatus.NOT_FOUND); }
}
export class UnsupportedModelVersionError extends DomainError {
  constructor(version: string) {
    super('UNSUPPORTED_MODEL_VERSION', `Model version ${version} is not supported`, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}
// GlobalExceptionFilter: DomainError → { statusCode, code, message, details?, requestId, timestamp }
```

## Unit test skeleton (plain mocks, house style)
```ts
const repo = () => ({ findOne: jest.fn(), update: jest.fn(), create: jest.fn((x) => x), save: jest.fn() });
let scansRepo: ReturnType<typeof repo>; let service: ScansService;
const registry = { assertValidRun: jest.fn() };
const llm = { analyze: jest.fn(), promptVersion: 'analysis-v1' };
beforeEach(() => { scansRepo = repo(); service = new ScansService(scansRepo as any, registry as any, new IngredientIntelligenceService(rules), llm as any); });
it('stores structured ingredients even when analysis fails', async () => {
  scansRepo.findOne.mockResolvedValue(fixtureScan({ detections: [fixtureDetection('sugar', 0.91)] }));
  llm.analyze.mockRejectedValue(new Error('timeout'));
  await service.process('scan-1');
  expect(scansRepo.update).toHaveBeenCalledWith({ id: 'scan-1' }, expect.objectContaining({ analysis: null, status: ScanStatus.DONE }));
});
it('rejects a run from an unsupported model version before persisting', async () => {
  registry.assertValidRun.mockRejectedValue(new UnsupportedModelVersionError('yolov8n-ingredients-9.9.9'));
  await expect(service.submit(fixtureRun())).rejects.toBeInstanceOf(UnsupportedModelVersionError);
  expect(scansRepo.save).not.toHaveBeenCalled();
});
```
