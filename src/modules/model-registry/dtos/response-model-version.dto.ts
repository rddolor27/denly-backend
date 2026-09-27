import { ApiProperty } from '@nestjs/swagger';
import { ModelVersionStatus } from '../constants/model-registry.constants.js';
import type {
  ModelClassModel,
  ModelVersionModel,
} from '../models/model-version.model.js';

export class ResponseModelClassDTO {
  @ApiProperty({ minimum: 0, example: 1 })
  classId!: number;

  @ApiProperty({ example: 'tomato' })
  className!: string;

  static fromModel(model: ModelClassModel): ResponseModelClassDTO {
    return Object.assign(new ResponseModelClassDTO(), {
      classId: model.classId,
      className: model.className,
    });
  }
}

export class ResponseModelVersionDTO {
  @ApiProperty({ example: 'yolov8n-ingredients-0.1.0' })
  id!: string;

  @ApiProperty({ enum: ModelVersionStatus, enumName: 'ModelVersionStatus' })
  status!: ModelVersionStatus;

  @ApiProperty({ type: String, nullable: true, example: '2026.09.2' })
  taxonomyVersion!: string | null;

  @ApiProperty({ example: 100 })
  classCount!: number;

  @ApiProperty({ description: 'SHA-256 of the classes file, hex' })
  classesSha256!: string;

  @ApiProperty({ example: '2026-09-23T10:00:00.000Z' })
  createdAt!: string;

  static fromModel(model: ModelVersionModel): ResponseModelVersionDTO {
    return Object.assign(new ResponseModelVersionDTO(), {
      id: model.id,
      status: model.status,
      taxonomyVersion: model.taxonomyVersion,
      classCount: model.classCount,
      classesSha256: model.classesSha256,
      createdAt: model.createdAt.toISOString(),
    });
  }
}

export class ResponseModelVersionDetailDTO extends ResponseModelVersionDTO {
  @ApiProperty({ type: [ResponseModelClassDTO] })
  classes!: ResponseModelClassDTO[];

  static override fromModel(
    model: ModelVersionModel,
  ): ResponseModelVersionDetailDTO {
    return Object.assign(new ResponseModelVersionDetailDTO(), {
      ...ResponseModelVersionDTO.fromModel(model),
      classes: (model.classes ?? []).map((c) =>
        ResponseModelClassDTO.fromModel(c),
      ),
    });
  }
}
