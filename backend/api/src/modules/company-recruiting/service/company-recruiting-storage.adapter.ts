import { Injectable } from "@nestjs/common";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import type { CompanyRecruitingStorageAdapterPort, CompanyRecruitingStoragePutObjectInput } from "./company-recruiting.service";

@Injectable()
export class S3CompanyRecruitingStorageAdapter implements CompanyRecruitingStorageAdapterPort {
  private readonly client = new S3Client({
    region: process.env.AWS_REGION ?? "ap-northeast-2",
    endpoint: process.env.AWS_ENDPOINT_URL || undefined,
    forcePathStyle: Boolean(process.env.AWS_ENDPOINT_URL),
    credentials:
      process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined,
  });

  private readonly bucket = process.env.S3_BUCKET_NAME ?? process.env.S3_BUCKET;

  async putObject(input: CompanyRecruitingStoragePutObjectInput): Promise<void> {
    if (!this.bucket) {
      throw new Error("S3_BUCKET or S3_BUCKET_NAME is required.");
    }

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentLength: input.contentLength,
        ContentType: input.contentType,
      }),
    );
  }
}
