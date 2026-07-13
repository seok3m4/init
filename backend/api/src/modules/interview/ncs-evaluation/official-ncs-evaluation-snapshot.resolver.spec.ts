import { BuiltInNcsEvaluationSnapshotResolver } from "./built-in-ncs-evaluation-snapshot.resolver";
import { parseNcsEvaluationSnapshot } from "./ncs-evaluation-snapshot";
import { OfficialNcsEvaluationSnapshotResolver } from "./official-ncs-evaluation-snapshot.resolver";
import { OfficialNcsReferenceCatalogService, type OfficialNcsUnit } from "./official-ncs-reference-catalog.service";

describe("OfficialNcsEvaluationSnapshotResolver", () => {
  const officialUnit: OfficialNcsUnit = {
    dutyCode: "20010202",
    dutyName: "응용SW엔지니어링",
    ncsDegree: 29,
    unitCode: "2001020221_23v6",
    unitName: "애플리케이션 설계",
    definition: "요구사항을 분석하여 애플리케이션 구조와 구성 요소를 설계하는 능력이다.",
    level: 5,
    elements: [
      { elementCode: "2001020221_23v6.1", name: "요구사항 분석하기" },
      { elementCode: "2001020221_23v6.2", name: "설계 대안 검토하기" },
    ],
  };

  it("creates a deterministic official snapshot and a role-specific interview question", () => {
    const catalog = { resolve: jest.fn(() => officialUnit) } as unknown as OfficialNcsReferenceCatalogService;
    const resolver = new OfficialNcsEvaluationSnapshotResolver(catalog, new BuiltInNcsEvaluationSnapshotResolver());
    const question = {
      questionId: 7201,
      questionType: "TECHNICAL" as const,
      content: "지원 직무에서 기술 대안을 비교한 경험을 설명해주세요.",
      sortOrder: 1,
      interviewType: "MOCK" as const,
      jobRole: "백엔드 개발자",
      isActive: true,
    };

    const first = resolver.resolve(question);
    const second = resolver.resolve(question);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      jobRole: "백엔드 개발자",
      question: {
        content: "애플리케이션 설계 업무에서 기술 대안을 비교하고 선택했던 경험을 판단 기준과 검증 결과까지 포함해 설명해주세요.",
      },
      ncsContext: {
        sourceKind: "OFFICIAL_NCS",
        version: "hrdkapi:NCS007:ncs-degr-29:2001020221_23v6",
        unit: {
          code: "2001020221_23v6",
          name: "응용SW엔지니어링 - 애플리케이션 설계",
          level: 5,
        },
      },
    });
    expect(first?.behaviorPoints[0]?.sourceElementCodes).toEqual([
      "2001020221_23v6.1",
      "2001020221_23v6.2",
    ]);
    expect(parseNcsEvaluationSnapshot(first)).toEqual(first);
  });

  it("falls back to the synthetic role profile when no official mapping is available", () => {
    const catalog = { resolve: jest.fn(() => undefined) } as unknown as OfficialNcsReferenceCatalogService;
    const resolver = new OfficialNcsEvaluationSnapshotResolver(catalog, new BuiltInNcsEvaluationSnapshotResolver());

    const snapshot = resolver.resolve({
      questionId: 7201,
      questionType: "TECHNICAL",
      content: "기술 의사결정 경험을 설명해주세요.",
      sortOrder: 1,
      interviewType: "MOCK",
      jobRole: "백엔드 개발자",
      isActive: true,
    });

    expect(snapshot?.ncsContext.sourceKind).toBe("SYNTHETIC_NCS_LIKE");
    expect(snapshot?.ncsContext.unit.code).toBe("SERVICE-JOB-BACKEND-TECHNICAL-DECISION");
  });
});
