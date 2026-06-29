import "reflect-metadata";
import { strict as assert } from "node:assert";
import { MODULE_METADATA } from "@nestjs/common/constants";
import { CandidateModule } from "../candidate";
import { InterviewModule } from "../interview";
import { ReportController } from "./report.controller";
import { ReportModule } from "./report.module";
import { ReportService } from "./report.service";

const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, ReportModule) as unknown[];
const controllers = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, ReportModule) as unknown[];
const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, ReportModule) as unknown[];
const exportsMetadata = Reflect.getMetadata(MODULE_METADATA.EXPORTS, ReportModule) as unknown[];

assert.ok(imports.includes(CandidateModule));
assert.ok(imports.includes(InterviewModule));
assert.ok(controllers.includes(ReportController));
assert.ok(providers.includes(ReportService));
assert.ok(exportsMetadata.includes(ReportService));
