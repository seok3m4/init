import { NcsOpenApiClient, loadNcsOpenApiConfig } from "./ncs-open-api.client";

describe("NcsOpenApiClient", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("loads a server-only service key and defaults", () => {
    expect(loadNcsOpenApiConfig({ NCS_OPEN_API_SERVICE_KEY: " decoded-key " })).toEqual({
      serviceKey: "decoded-key",
      baseUrl: "https://apis.data.go.kr/B490007/ncsInfo",
      timeoutMs: 10_000,
    });
  });

  it("rejects missing credentials and invalid configuration", () => {
    expect(() => loadNcsOpenApiConfig({})).toThrow("NCS_OPEN_API_SERVICE_KEY");
    expect(() => loadNcsOpenApiConfig({
      NCS_OPEN_API_SERVICE_KEY: "key",
      NCS_OPEN_API_BASE_URL: "http://apis.data.go.kr/B490007/ncsInfo",
    })).toThrow("HTTPS");
    expect(() => loadNcsOpenApiConfig({
      NCS_OPEN_API_SERVICE_KEY: "key",
      NCS_OPEN_API_TIMEOUT_MS: "0",
    })).toThrow("positive integer");
  });

  it("adds the service key without exposing it to call parameters", async () => {
    let requestedUrl = "";
    globalThis.fetch = jest.fn(async (input: string | URL | Request) => {
      requestedUrl = String(input);
      return new Response("<response><body /></response>", { status: 200 });
    }) as typeof fetch;

    const client = new NcsOpenApiClient();
    const body = await client.requestXml(
      "ncsDutyInfo",
      { pageNo: 1, numOfRows: 100 },
      { NCS_OPEN_API_SERVICE_KEY: "key+/=" },
    );

    const url = new URL(requestedUrl);
    expect(url.pathname).toBe("/B490007/ncsInfo/ncsDutyInfo");
    expect(url.searchParams.get("serviceKey")).toBe("key+/=");
    expect(url.searchParams.get("pageNo")).toBe("1");
    expect(url.searchParams.get("numOfRows")).toBe("100");
    expect(body).toContain("<body");
  });

  it("does not include the credential in provider errors", async () => {
    globalThis.fetch = jest.fn(async () => new Response("provider failure", { status: 500 })) as typeof fetch;
    const client = new NcsOpenApiClient();

    await expect(client.requestXml("ncsDutyInfo", {}, {
      NCS_OPEN_API_SERVICE_KEY: "private-key",
    })).rejects.toThrow("status 500");
    await expect(client.requestXml("ncsDutyInfo", {}, {
      NCS_OPEN_API_SERVICE_KEY: "private-key",
    })).rejects.not.toThrow("private-key");
  });
});
