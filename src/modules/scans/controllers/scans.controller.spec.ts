import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalysisStatus } from '../constants/scans.constants.js';
import { ListScansQueryDTO } from '../dtos/list-scans-query.dto.js';
import type { SubmitScanDTO } from '../dtos/submit-scan.dto.js';
import type { IScansService } from '../interfaces/scans-service.interface.js';
import { toDetectionRun } from '../models/detection-run.mapper.js';
import type { ScanModel } from '../models/scan.model.js';
import { ScansController } from './scans.controller.js';

const USER = { id: '0b6f4c1e-3f7a-4d2b-9a51-8c2d7e6f1a20' };

function fixtureScanModel(): ScanModel {
  return {
    id: 'scan-1',
    createdAt: new Date('2026-09-23T00:00:00.000Z'),
    modelVersion: 'yolov8n-ingredients-0.1.0',
    rulesVersion: 'rules-test-1',
    promptVersion: null,
    imageSize: { w: 640, h: 480 },
    latencyMs: 120,
    detections: [],
    result: {
      scanId: 'scan-1',
      rulesVersion: 'rules-test-1',
      ingredients: [],
      unknowns: [],
      flags: [],
    },
    analysisStatus: AnalysisStatus.UNAVAILABLE,
    analysis: null,
  };
}

describe('ScansController', () => {
  let scansServiceMock: {
    submit: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
  };
  let controller: ScansController;

  beforeEach(() => {
    scansServiceMock = { submit: vi.fn(), list: vi.fn(), findOne: vi.fn() };
    controller = new ScansController(
      scansServiceMock as unknown as IScansService,
    );
  });

  it('maps the DTO to a DetectionRun, submits it and returns the response DTO', async () => {
    const model = fixtureScanModel();
    scansServiceMock.submit.mockResolvedValue(model);
    const dto: SubmitScanDTO = {
      modelVersion: 'yolov8n-ingredients-0.1.0',
      imageSize: { w: 640, h: 480 },
      latencyMs: 120,
      detections: [],
    };

    const result = await controller.submit(USER, dto);

    expect(scansServiceMock.submit).toHaveBeenCalledWith(
      USER.id,
      toDetectionRun(dto),
    );
    expect(result.id).toBe('scan-1');
    expect(result.analysisStatus).toBe(AnalysisStatus.UNAVAILABLE);
  });

  it('lists the current user history with the query limit and cursor', async () => {
    const { detections: _detections, ...summary } = fixtureScanModel();
    scansServiceMock.list.mockResolvedValue({
      items: [summary],
      nextCursor: 'next',
    });
    const query = Object.assign(new ListScansQueryDTO(), {
      limit: 5,
      cursor: 'abc',
    });

    const result = await controller.list(USER, query);

    expect(scansServiceMock.list).toHaveBeenCalledWith(USER.id, {
      limit: 5,
      cursor: 'abc',
    });
    expect(result.items.map((item) => item.id)).toEqual(['scan-1']);
    expect(result.nextCursor).toBe('next');
  });

  it('returns the response DTO for an existing scan', async () => {
    const model = fixtureScanModel();
    scansServiceMock.findOne.mockResolvedValue(model);

    const result = await controller.findOne(USER, 'scan-1');

    expect(scansServiceMock.findOne).toHaveBeenCalledWith(USER.id, 'scan-1');
    expect(result.id).toBe('scan-1');
  });
});
