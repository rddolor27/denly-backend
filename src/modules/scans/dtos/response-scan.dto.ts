import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  ConfidenceBand,
  StructuredIngredientData,
} from '@/modules/ingredient-intelligence/models/structured-ingredient-data.model.js';
import { AnalysisStatus } from '../constants/scans.constants.js';
import type {
  ScanModel,
  ScanPage,
  ScanSummaryModel,
} from '../models/scan.model.js';

export class ResponseBoundingBoxDTO {
  @ApiProperty() readonly x1!: number;
  @ApiProperty() readonly y1!: number;
  @ApiProperty() readonly x2!: number;
  @ApiProperty() readonly y2!: number;
}

export class ResponseImageSizeDTO {
  @ApiProperty() readonly w!: number;
  @ApiProperty() readonly h!: number;
}

export class ResponseDetectionDTO {
  @ApiProperty() readonly id!: string;
  @ApiProperty() readonly classId!: number;
  @ApiProperty() readonly className!: string;
  @ApiProperty({ type: ResponseBoundingBoxDTO })
  readonly bbox!: ResponseBoundingBoxDTO;
  @ApiProperty() readonly confidence!: number;
}

export class ResponseIngredientMetadataDTO {
  @ApiProperty({ type: [String] }) readonly allergens!: readonly string[];
}

export class ResponseStructuredIngredientDTO {
  @ApiProperty() readonly ingredientId!: string;
  @ApiProperty() readonly slug!: string;
  @ApiProperty() readonly canonicalName!: string;
  @ApiProperty() readonly category!: string;
  @ApiProperty() readonly confidence!: number;
  @ApiProperty({ enum: ['high', 'medium', 'low'] })
  readonly confidenceBand!: ConfidenceBand;
  @ApiProperty({ type: [String] }) readonly detectionIds!: readonly string[];
  @ApiProperty({ type: ResponseIngredientMetadataDTO })
  readonly metadata!: ResponseIngredientMetadataDTO;
  @ApiProperty({ type: [String] }) readonly dietaryFlags!: readonly string[];
  @ApiProperty({ type: [String] }) readonly ruleHits!: readonly string[];
}

export class ResponseUnknownDetectionDTO {
  @ApiProperty() readonly className!: string;
  @ApiProperty() readonly confidence!: number;
  @ApiProperty({ type: [String] }) readonly detectionIds!: readonly string[];
}

function toStructuredResult(result: StructuredIngredientData): {
  ingredients: ResponseStructuredIngredientDTO[];
  unknowns: ResponseUnknownDetectionDTO[];
  flags: readonly string[];
} {
  return {
    ingredients: result.ingredients.map((ingredient) => ({
      ingredientId: ingredient.ingredientId,
      slug: ingredient.slug,
      canonicalName: ingredient.canonicalName,
      category: ingredient.category,
      confidence: ingredient.confidence,
      confidenceBand: ingredient.confidenceBand,
      detectionIds: ingredient.detectionIds,
      metadata: { allergens: ingredient.metadata.allergens },
      dietaryFlags: ingredient.dietaryFlags,
      ruleHits: ingredient.ruleHits,
    })),
    unknowns: result.unknowns.map((unknown) => ({
      className: unknown.className,
      confidence: unknown.confidence,
      detectionIds: unknown.detectionIds,
    })),
    flags: result.flags,
  };
}

export class ResponseScanSummaryDTO {
  @ApiProperty() readonly id!: string;
  @ApiProperty() readonly createdAt!: string;
  @ApiProperty() readonly modelVersion!: string;
  @ApiProperty() readonly rulesVersion!: string;
  @ApiProperty({ type: [ResponseStructuredIngredientDTO] })
  readonly ingredients!: readonly ResponseStructuredIngredientDTO[];
  @ApiProperty({ type: [ResponseUnknownDetectionDTO] })
  readonly unknowns!: readonly ResponseUnknownDetectionDTO[];
  @ApiProperty({ type: [String] }) readonly flags!: readonly string[];
  @ApiProperty({ enum: AnalysisStatus })
  readonly analysisStatus!: AnalysisStatus;

  static fromModel(model: ScanSummaryModel): ResponseScanSummaryDTO {
    return Object.assign(new ResponseScanSummaryDTO(), {
      id: model.id,
      createdAt: model.createdAt.toISOString(),
      modelVersion: model.modelVersion,
      rulesVersion: model.rulesVersion,
      ...toStructuredResult(model.result),
      analysisStatus: model.analysisStatus,
    });
  }
}

export class ResponseScanPageDTO {
  @ApiProperty({ type: [ResponseScanSummaryDTO] })
  readonly items!: readonly ResponseScanSummaryDTO[];
  @ApiProperty({ type: String, nullable: true })
  readonly nextCursor!: string | null;

  static fromModel(page: ScanPage): ResponseScanPageDTO {
    return Object.assign(new ResponseScanPageDTO(), {
      items: page.items.map((item) => ResponseScanSummaryDTO.fromModel(item)),
      nextCursor: page.nextCursor,
    });
  }
}

export class ResponseScanDTO {
  @ApiProperty() readonly id!: string;
  @ApiProperty() readonly createdAt!: string;
  @ApiProperty() readonly modelVersion!: string;
  @ApiProperty() readonly rulesVersion!: string;
  @ApiProperty({ type: String, nullable: true }) readonly promptVersion!:
    string | null;
  @ApiProperty({ type: ResponseImageSizeDTO })
  readonly imageSize!: ResponseImageSizeDTO;
  @ApiProperty() readonly latencyMs!: number;
  @ApiProperty({ type: [ResponseDetectionDTO] })
  readonly detections!: readonly ResponseDetectionDTO[];
  @ApiProperty({ type: [ResponseStructuredIngredientDTO] })
  readonly ingredients!: readonly ResponseStructuredIngredientDTO[];
  @ApiProperty({ type: [ResponseUnknownDetectionDTO] })
  readonly unknowns!: readonly ResponseUnknownDetectionDTO[];
  @ApiProperty({ type: [String] }) readonly flags!: readonly string[];
  @ApiProperty({ enum: AnalysisStatus })
  readonly analysisStatus!: AnalysisStatus;
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  readonly analysis!: Readonly<Record<string, unknown>> | null;

  static fromModel(model: ScanModel): ResponseScanDTO {
    return Object.assign(new ResponseScanDTO(), {
      id: model.id,
      createdAt: model.createdAt.toISOString(),
      modelVersion: model.modelVersion,
      rulesVersion: model.rulesVersion,
      promptVersion: model.promptVersion,
      imageSize: { w: model.imageSize.w, h: model.imageSize.h },
      latencyMs: model.latencyMs,
      detections: model.detections.map((detection) => ({
        id: detection.id,
        classId: detection.classId,
        className: detection.className,
        bbox: {
          x1: detection.bbox.x1,
          y1: detection.bbox.y1,
          x2: detection.bbox.x2,
          y2: detection.bbox.y2,
        },
        confidence: detection.confidence,
      })),
      ...toStructuredResult(model.result),
      analysisStatus: model.analysisStatus,
      analysis: model.analysis,
    });
  }
}
