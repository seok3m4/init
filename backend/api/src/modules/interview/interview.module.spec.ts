import "reflect-metadata";
import { strict as assert } from "node:assert";
import { MODULE_METADATA } from "@nestjs/common/constants";
import { CandidateModule } from "../candidate";
import { InterviewController } from "./interview.controller";
import { InterviewModule } from "./interview.module";
import { InterviewService } from "./interview.service";

const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, InterviewModule) as unknown[];
const controllers = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, InterviewModule) as unknown[];
const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, InterviewModule) as unknown[];
const exportsMetadata = Reflect.getMetadata(MODULE_METADATA.EXPORTS, InterviewModule) as unknown[];

assert.ok(imports.includes(CandidateModule));
assert.ok(controllers.includes(InterviewController));
assert.ok(providers.includes(InterviewService));
assert.ok(exportsMetadata.includes(InterviewService));
