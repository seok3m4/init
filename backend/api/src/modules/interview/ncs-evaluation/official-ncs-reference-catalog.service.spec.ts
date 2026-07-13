import { NcsOpenApiClient } from "./ncs-open-api.client";
import { OfficialNcsReferenceCatalogService } from "./official-ncs-reference-catalog.service";

describe("OfficialNcsReferenceCatalogService", () => {
  it("loads active NCS007 rows and resolves the latest preferred unit revision", async () => {
    let inFlight = 0;
    let maximumInFlight = 0;
    const client = mockClient(async (_operation, query) => {
      inFlight += 1;
      maximumInFlight = Math.max(maximumInFlight, inFlight);
      await Promise.resolve();
      const response = responseForKeyword(String(query.SWRD));
      inFlight -= 1;
      return response;
    });
    const catalog = new OfficialNcsReferenceCatalogService(client);

    await catalog.synchronize({ NCS_OPEN_API_SERVICE_KEY: "key" });

    const unit = catalog.resolve("백엔드 개발자", "TECHNICAL");
    expect(unit).toMatchObject({
      dutyName: "응용SW엔지니어링",
      ncsDegree: 29,
      unitCode: "2001020221_23v6",
      unitName: "애플리케이션 설계",
      level: 5,
    });
    expect(unit?.elements).toEqual([
      { elementCode: "2001020221_23v6.1", name: "요구사항 분석하기" },
      { elementCode: "2001020221_23v6.2", name: "설계 대안 검토하기" },
    ]);
    expect(catalog.status()).toMatchObject({ synchronized: true, failedKeywordCount: 0 });
    expect(maximumInFlight).toBe(1);
  });

  it("returns no official mapping for unknown roles or unsupported question types", async () => {
    const catalog = new OfficialNcsReferenceCatalogService(mockClient(async () => responseForKeyword("응용SW")));
    await catalog.synchronize({ NCS_OPEN_API_SERVICE_KEY: "key" });

    expect(catalog.resolve("게임 개발자", "TECHNICAL")).toBeUndefined();
    expect(catalog.resolve("백엔드 개발자", "FOLLOW_UP")).toBeUndefined();
  });

  it("keeps startup usable when every official request fails", async () => {
    const catalog = new OfficialNcsReferenceCatalogService(mockClient(async () => {
      throw new Error("network unavailable");
    }));

    await expect(catalog.synchronize({ NCS_OPEN_API_SERVICE_KEY: "key" })).resolves.toBeUndefined();
    expect(catalog.status()).toEqual({
      synchronized: false,
      synchronizedAt: null,
      unitCount: 0,
      failedKeywordCount: 5,
    });
  });
});

function mockClient(
  implementation: (operation: string, query: Record<string, unknown>) => Promise<unknown>,
): NcsOpenApiClient {
  return {
    isConfigured: jest.fn(() => true),
    requestJson: jest.fn(implementation),
  } as unknown as NcsOpenApiClient;
}

function responseForKeyword(keyword: string): unknown {
  const items = keyword === "응용SW"
    ? [
        row({ NCS_DEGR: "28", NCS_CL_CD: "2001020221_22v5" }),
        row({
          NCS_DEGR: "29",
          NCS_CL_CD: "2001020221_23v6",
          COMPE_UNIT_FACTR_NO_CD: "2001020221_23v6.1",
          COMPE_UNIT_FACTR_NO: "1",
          COMPE_UNIT_FACTR_NAME: "요구사항 분석하기",
        }),
        row({
          NCS_DEGR: "29",
          NCS_CL_CD: "2001020221_23v6",
          COMPE_UNIT_FACTR_NO_CD: "2001020221_23v6.2",
          COMPE_UNIT_FACTR_NO: "2",
          COMPE_UNIT_FACTR_NAME: "설계 대안 검토하기",
        }),
        row({ NCS_DEGR: "30", NCS_CL_CD: "inactive", USG_YN: "N" }),
      ]
    : [];
  return { response: { header: { resultCode: "00" }, body: { items: { item: items } } } };
}

function row(overrides: Record<string, string>): Record<string, string> {
  return {
    USG_YN: "Y",
    NCS_SUBD_CD: "20010202",
    NCS_SUBD_CDNM: "응용SW엔지니어링",
    NCS_DEGR: "29",
    NCS_CL_CD: "2001020221_23v6",
    COMPE_UNIT_NAME: "애플리케이션 설계",
    COMPE_UNIT_DEF: "요구사항을 분석하여 애플리케이션 구조와 구성 요소를 설계하는 능력이다.",
    COMPE_UNIT_LEVEL: "5",
    COMPE_UNIT_FACTR_NO_CD: "2001020221_23v6.1",
    COMPE_UNIT_FACTR_NO: "1",
    COMPE_UNIT_FACTR_NAME: "요구사항 분석하기",
    ...overrides,
  };
}
