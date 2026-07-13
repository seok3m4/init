import { NcsOpenApiClient, loadNcsOpenApiConfig } from "./ncs-open-api.client";

describe("NcsOpenApiClient", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("loads server-only credentials and separate reference/detail endpoints", () => {
    expect(loadNcsOpenApiConfig({ NCS_OPEN_API_SERVICE_KEY: " decoded-key " })).toEqual({
      serviceKey: "decoded-key",
      baseUrl: "https://apis.data.go.kr/B490007/hrdkapi",
      detailBaseUrl: "https://apis.data.go.kr/B490007/ncsInfo",
      timeoutMs: 30_000,
    });
  });

  it("rejects missing credentials and invalid configuration", () => {
    expect(() => loadNcsOpenApiConfig({})).toThrow("NCS_OPEN_API_SERVICE_KEY");
    expect(() => loadNcsOpenApiConfig({
      NCS_OPEN_API_SERVICE_KEY: "key",
      NCS_OPEN_API_BASE_URL: "http://apis.data.go.kr/B490007/hrdkapi",
    })).toThrow("HTTPS");
    expect(() => loadNcsOpenApiConfig({
      NCS_OPEN_API_SERVICE_KEY: "key",
      NCS_OPEN_API_DETAIL_BASE_URL: "http://apis.data.go.kr/B490007/ncsInfo",
    })).toThrow("HTTPS");
    expect(() => loadNcsOpenApiConfig({
      NCS_OPEN_API_SERVICE_KEY: "key",
      NCS_OPEN_API_TIMEOUT_MS: "0",
    })).toThrow("positive integer");
  });

  it("requests JSON reference data with a server-owned service key", async () => {
    let requestedUrl = "";
    globalThis.fetch = jest.fn(async (input: string | URL | Request) => {
      requestedUrl = String(input);
      return new Response(JSON.stringify({ response: { header: { resultCode: "00" }, body: { items: {} } } }), {
        status: 200,
      });
    }) as typeof fetch;

    const client = new NcsOpenApiClient();
    const body = await client.requestJson("NCS007", { LVL: 1, SWRD: "응용SW" }, {
      NCS_OPEN_API_SERVICE_KEY: "key+/=",
    });

    const url = new URL(requestedUrl);
    expect(url.pathname).toBe("/B490007/hrdkapi/NCS007");
    expect(url.searchParams.get("serviceKey")).toBe("key+/=");
    expect(url.searchParams.get("LVL")).toBe("1");
    expect(url.searchParams.get("SWRD")).toBe("응용SW");
    expect(body).toEqual(expect.objectContaining({ response: expect.any(Object) }));
  });

  it("keeps the detail XML API on its separate endpoint", async () => {
    let requestedUrl = "";
    globalThis.fetch = jest.fn(async (input: string | URL | Request) => {
      requestedUrl = String(input);
      return new Response("<response><body /></response>", { status: 200 });
    }) as typeof fetch;

    const client = new NcsOpenApiClient();
    await client.requestXml("ncsDutyInfo", { pageNo: 1 }, { NCS_OPEN_API_SERVICE_KEY: "key" });
    expect(new URL(requestedUrl).pathname).toBe("/B490007/ncsInfo/ncsDutyInfo");
  });

  it("rejects provider errors without including credentials", async () => {
    globalThis.fetch = jest.fn(async () => new Response(JSON.stringify({
      response: { header: { resultCode: "03", resultMsg: "provider failure" } },
    }), { status: 200 })) as typeof fetch;
    const client = new NcsOpenApiClient();

    await expect(client.requestJson("NCS001", {}, {
      NCS_OPEN_API_SERVICE_KEY: "private-key",
    })).rejects.toThrow("provider error 03");
    await expect(client.requestJson("NCS001", {}, {
      NCS_OPEN_API_SERVICE_KEY: "private-key",
    })).rejects.not.toThrow("private-key");
  });
});
