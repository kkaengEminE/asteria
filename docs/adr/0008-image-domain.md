# ADR 0008: Image Asset Domain

## Context

Asteria will eventually use image libraries from providers such as Google Drive, S3, local storage, or Cloudinary. If those provider details shape workflow logic directly, future provider replacement and image selection will become brittle.

Before implementing an image storage adapter, Asteria needs a storage-agnostic image model.

## Decision

Asteria will define the Image Asset Domain under `src/domain/image`.

The domain will include:

- Image asset identity and URI.
- Metadata such as filename, title, description, tags, category, dimensions, orientation, taken date, rating, favorite flag, source reference, and checksum.
- Search query and selection criteria.
- Tag normalization and filtering.
- Domain-level scoring and selection helpers.
- A storage-agnostic image library interface shape for future providers.

The image domain will not know about Google Drive, S3, local file systems, Cloudinary, OAuth, SDKs, bucket names, folder paths, or provider-specific APIs.

## Consequences

Future image providers can adapt their metadata into a common model before workflows use image candidates. Image selection remains testable without real storage integrations. The tradeoff is that provider-specific features may need explicit mapping later rather than being used directly in workflow code.

