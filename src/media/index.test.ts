import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestR2Bucket } from "../test-support";
import {
  buildPostImagePath,
  MAX_POST_IMAGE_ALT_TEXT_LENGTH,
  MAX_POST_IMAGE_ATTACHMENTS,
  MAX_POST_IMAGE_BYTES,
  parsePostImageAttachment,
  PostImageValidationError,
  storeUploadedPostImages,
} from "./index";

describe("storeUploadedPostImages", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stores uploaded post images with sanitized metadata", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("11111111-1111-4111-8111-111111111111");

    const bucket = createTestR2Bucket();
    const [attachment] = await storeUploadedPostImages(bucket, {
      altTexts: ["  Product screenshot for the release note.  "],
      files: [new File([Uint8Array.of(1, 2, 3)], " spaced name?.png ", { type: "image/png" })],
      keyPrefix: " /drafts/queue/ ",
    });

    expect(attachment).toEqual({
      id: "drafts/queue/11111111-1111-4111-8111-111111111111-spaced-name.png",
      objectKey: "drafts/queue/11111111-1111-4111-8111-111111111111-spaced-name.png",
      fileName: "spaced-name.png",
      contentType: "image/png",
      sizeBytes: 3,
      altText: "Product screenshot for the release note.",
    });
    await expect(bucket.get(attachment.objectKey)).resolves.toMatchObject({
      customMetadata: {
        altText: "Product screenshot for the release note.",
        fileName: "spaced-name.png",
      },
      httpMetadata: {
        cacheControl: "private, no-store",
        contentDisposition: 'inline; filename="spaced-name.png"',
        contentType: "image/png",
      },
    });
  });

  it("uses the default key prefix when none is provided", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("22222222-2222-4222-8222-222222222222");

    const bucket = createTestR2Bucket();
    const [attachment] = await storeUploadedPostImages(bucket, {
      altTexts: ["Alt text"],
      files: [new File([Uint8Array.of(4, 5, 6)], "image.png", { type: "image/png" })],
    });

    expect(attachment.objectKey).toBe("post-media/22222222-2222-4222-8222-222222222222-image.png");
  });

  it("returns an empty list when no files are attached", async () => {
    const bucket = createTestR2Bucket();

    await expect(
      storeUploadedPostImages(bucket, {
        altTexts: [],
        files: [],
      }),
    ).resolves.toEqual([]);
  });

  it.each([
    {
      name: "too many files are attached",
      altTexts: new Array(MAX_POST_IMAGE_ATTACHMENTS + 1).fill("Alt text"),
      files: new Array(MAX_POST_IMAGE_ATTACHMENTS + 1)
        .fill(null)
        .map((_, index) => new File([Uint8Array.of(index + 1)], `image-${index + 1}.png`, { type: "image/png" })),
      message: `Attach up to ${MAX_POST_IMAGE_ATTACHMENTS} images per post.`,
    },
    {
      name: "alt text count does not match files",
      altTexts: [],
      files: [new File([Uint8Array.of(1)], "image.png", { type: "image/png" })],
      message: "Add alt text for every attached image.",
    },
    {
      name: "an unsupported content type is uploaded",
      altTexts: ["Alt text"],
      files: [new File([Uint8Array.of(1)], "image.txt", { type: "text/plain" })],
      message: "Only PNG, JPEG, WEBP, and GIF uploads are supported.",
    },
    {
      name: "an empty file is uploaded",
      altTexts: ["Alt text"],
      files: [new File([], "image.png", { type: "image/png" })],
      message: "Attached image files cannot be empty.",
    },
    {
      name: "an image exceeds the size limit",
      altTexts: ["Alt text"],
      files: [new File([new Uint8Array(MAX_POST_IMAGE_BYTES + 1)], "image.png", { type: "image/png" })],
      message: `Each image must stay under ${Math.floor(MAX_POST_IMAGE_BYTES / (1024 * 1024))} MB.`,
    },
    {
      name: "alt text is blank",
      altTexts: ["   "],
      files: [new File([Uint8Array.of(1)], "image.png", { type: "image/png" })],
      message: "Add alt text for every attached image.",
    },
    {
      name: "alt text exceeds the limit",
      altTexts: ["a".repeat(MAX_POST_IMAGE_ALT_TEXT_LENGTH + 1)],
      files: [new File([Uint8Array.of(1)], "image.png", { type: "image/png" })],
      message: `Alt text must stay under ${MAX_POST_IMAGE_ALT_TEXT_LENGTH} characters.`,
    },
  ])("rejects uploads when $name", async ({ altTexts, files, message }) => {
    const bucket = createTestR2Bucket();

    await expect(
      storeUploadedPostImages(bucket, {
        altTexts,
        files,
      }),
    ).rejects.toThrow(new PostImageValidationError(message));
  });
});

describe("media helpers", () => {
  it("builds encoded media paths", () => {
    expect(buildPostImagePath("folder/my image.png")).toBe("/media/folder%2Fmy%20image.png");
  });

  it("parses valid stored attachments and rejects invalid ones", () => {
    expect(
      parsePostImageAttachment({
        id: "post-media/uuid-image.png",
        objectKey: "post-media/uuid-image.png",
        fileName: "image.png",
        contentType: "image/png",
        sizeBytes: 123,
        altText: "Alt text",
      }),
    ).toEqual({
      id: "post-media/uuid-image.png",
      objectKey: "post-media/uuid-image.png",
      fileName: "image.png",
      contentType: "image/png",
      sizeBytes: 123,
      altText: "Alt text",
    });
    expect(
      parsePostImageAttachment({
        id: "post-media/uuid-image.txt",
        objectKey: "post-media/uuid-image.txt",
        fileName: "image.txt",
        contentType: "text/plain",
        sizeBytes: 123,
        altText: "Alt text",
      }),
    ).toBeNull();
    expect(parsePostImageAttachment(null)).toBeNull();
    expect(parsePostImageAttachment({ id: "missing-fields" })).toBeNull();
  });
});
