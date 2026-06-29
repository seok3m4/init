import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { AppModule } from "../app.module";
import { ApiExceptionFilter } from "../shared/api-exception.filter";
import { ApiResponseInterceptor } from "../shared/api-response.interceptor";
import { PrismaService } from "../shared/prisma.service";
import { setupSwagger } from "./swagger";

describe("Swagger setup", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalFilters(new ApiExceptionFilter());
    app.useGlobalInterceptors(new ApiResponseInterceptor());
    setupSwagger(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("serves OpenAPI JSON for currently implemented API routes only", async () => {
    const response = await request(app.getHttpServer()).get("/api-docs-json").expect(200);
    const paths = Object.keys(response.body.paths);

    expect(response.body.info.title).toBe("Final Weapon API");
    expect(paths).toContain("/api/v1/health");
    expect(paths).toContain("/api/v1/auth/login");
    expect(paths).toContain("/api/v1/company/recruitments");
    expect(paths).toContain("/api/v1/reports/{reportId}/generate");
    expect(paths).toContain("/api/v1/ai/guardrails/validate");
    expect(paths).not.toContain("/api/v1/candidate/jobs");
  });

  it("documents bearer auth and local dev auth headers", async () => {
    const response = await request(app.getHttpServer()).get("/api-docs-json").expect(200);
    const securitySchemes = response.body.components.securitySchemes;

    expect(securitySchemes.bearer).toEqual(expect.objectContaining({ type: "http", scheme: "bearer" }));
    expect(securitySchemes["x-dev-user-id"]).toEqual(expect.objectContaining({ type: "apiKey", in: "header" }));
    expect(securitySchemes["x-dev-user-type"]).toEqual(expect.objectContaining({ type: "apiKey", in: "header" }));
  });
});
