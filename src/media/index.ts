import type { R2BucketLike } from "../backup";

const DEFAULT_POST_IMAGE_PREFIX = "post-media";
const SUPPORTED_IMAGE_CONTENT_TYPES = new Set(["image/gif", "image/jpeg", "image/png", "image/webp"]);

export const MAX_POST_IMAGE_ATTACHMENTS = 4;
export const MAX_POST_IMAGE_ALT_TEXT_LENGTH = 500;
export const MAX_POST_IMAGE_BYTES = 5 * 1024 * 1024;

export interface PostImageAttachment {
  id: string;
  objectKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  altText: string;
}

export class PostImageValidationError extends Error {}

export async function storeUploadedPostImages(
  bucket: R2BucketLike,
  input: {
    altTexts: string[];
    files: File[];
    keyPrefix?: string;
  },
): Promise<PostImageAttachment[]> {
  if (input.files.length === 0) {
    return [];
  }

  if (input.files.length > MAX_POST_IMAGE_ATTACHMENTS) {
    throw new PostImageValidationError(`Attach up to ${MAX_POST_IMAGE_ATTACHMENTS} images per post.`);
  }

  if (input.altTexts.length !== input.files.length) {
    throw new PostImageValidationError("Add alt text for every attached image.");
  }

  const keyPrefix = normalizeKeyPrefix(input.keyPrefix);
  const attachments: PostImageAttachment[] = [];

  for (const [index, file] of input.files.entries()) {
    const contentType = normalizeImageContentType(file.type);
    if (!contentType) {
      throw new PostImageValidationError("Only PNG, JPEG, WEBP, and GIF uploads are supported.");
    }
    if (file.size === 0) {
      throw new PostImageValidationError("Attached image files cannot be empty.");
    }
    if (file.size > MAX_POST_IMAGE_BYTES) {
      throw new PostImageValidationError(`Each image must stay under ${Math.floor(MAX_POST_IMAGE_BYTES / (1024 * 1024))} MB.`);
    }

    const altText = input.altTexts[index]?.trim() || "";
    if (!altText) {
      throw new PostImageValidationError("Add alt text for every attached image.");
    }
    if (altText.length > MAX_POST_IMAGE_ALT_TEXT_LENGTH) {
      throw new PostImageValidationError(`Alt text must stay under ${MAX_POST_IMAGE_ALT_TEXT_LENGTH} characters.`);
    }

    const fileName = sanitizeFileName(file.name || `image-${index + 1}`);
    const objectKey = `${keyPrefix}/${crypto.randomUUID()}-${fileName}`;

    await bucket.put(objectKey, new Uint8Array(await file.arrayBuffer()), {
      httpMetadata: {
        cacheControl: "private, no-store",
        contentDisposition: `inline; filename="${fileName}"`,
        contentType,
      },
      customMetadata: {
        altText,
        fileName,
      },
    });

    attachments.push({
      id: objectKey,
      objectKey,
      fileName,
      contentType,
      sizeBytes: file.size,
      altText,
    });
  }

  return attachments;
}

export function buildPostImagePath(objectKey: string): string {
  return `/media/${encodeURIComponent(objectKey)}`;
}

export function parsePostImageAttachment(value: unknown): PostImageAttachment | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.objectKey !== "string" ||
    typeof candidate.fileName !== "string" ||
    typeof candidate.contentType !== "string" ||
    typeof candidate.sizeBytes !== "number" ||
    typeof candidate.altText !== "string"
  ) {
    return null;
  }

  if (!normalizeImageContentType(candidate.contentType)) {
    return null;
  }

  return {
    id: candidate.id,
    objectKey: candidate.objectKey,
    fileName: candidate.fileName,
    contentType: candidate.contentType,
    sizeBytes: candidate.sizeBytes,
    altText: candidate.altText,
  };
}

function normalizeKeyPrefix(value: string | undefined): string {
  const trimmed = (value || DEFAULT_POST_IMAGE_PREFIX).trim().replace(/^\/+|\/+$/g, "");
  return trimmed || DEFAULT_POST_IMAGE_PREFIX;
}

function normalizeImageContentType(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  return SUPPORTED_IMAGE_CONTENT_TYPES.has(trimmed) ? trimmed : null;
}

function sanitizeFileName(value: string): string {
  const normalized = value
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "");
  return normalized || "image";
}
