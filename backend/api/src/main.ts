import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { ApiExceptionFilter } from "./common/api-exception.filter";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  const port = Number.parseInt(process.env.PORT ?? "3001", 10);
  await app.listen(port);
}

void bootstrap();
