import type { PublishingPackage } from '../../domain/content/index.ts';
import type { ImageAsset } from '../../domain/image/index.ts';
import {
  createInstagramContentPackage,
  normalizeHashtags,
  type InstagramContentPackage
} from '../../domain/instagram/index.ts';
import type { MagazineProfile } from '../../domain/magazineProfile/index.ts';

export interface GenerateInstagramContentOptions {
  publishingPackage: PublishingPackage;
  magazineProfile: MagazineProfile;
  topic: string;
  selectedImage?: ImageAsset;
}

export class InstagramContentService {
  generate(options: GenerateInstagramContentOptions): InstagramContentPackage {
    const { publishingPackage, magazineProfile, topic, selectedImage } = options;
    const keywords = publishingPackage.seo.keywords;
    const title = publishingPackage.article.title;
    const summary = publishingPackage.summary.text || publishingPackage.article.summary;
    const shortCaption = createShortCaption(title, magazineProfile);
    const cta = createCallToAction(magazineProfile);
    const longCaption = createLongCaption({
      title,
      summary,
      cta,
      magazineProfile
    });

    return createInstagramContentPackage({
      magazineId: magazineProfile.id,
      magazineName: magazineProfile.name,
      topic,
      language: publishingPackage.article.language ?? magazineProfile.language,
      post: {
        caption: {
          short: shortCaption,
          long: longCaption,
          cta
        },
        hashtags: {
          primary: normalizeHashtags(keywords.slice(0, 8)),
          secondary: normalizeHashtags([
            ...magazineProfile.categories.slice(0, 5),
            magazineProfile.id,
            topic
          ]),
          branded: normalizeHashtags([
            magazineProfile.name,
            `${magazineProfile.id}magazine`,
            'asteria'
          ])
        },
        altText: createAltText(title, magazineProfile, selectedImage),
        imageSelectionReference: selectedImage
          ? `${selectedImage.id}:${selectedImage.metadata.filename}`
          : publishingPackage.imagePrompt.prompt
      },
      source: {
        articleTitle: title,
        seoKeywords: keywords
      },
      metadata: {
        dryRun: true,
        providerNeutral: true,
        generatedFrom: 'PublishingPackage',
        magazineTone: magazineProfile.tone,
        imageStyle: magazineProfile.imageStyle
      }
    });
  }
}

function createShortCaption(title: string, magazineProfile: MagazineProfile): string {
  return `${title} - ${magazineProfile.tone}`;
}

function createLongCaption(input: {
  title: string;
  summary: string;
  cta: string;
  magazineProfile: MagazineProfile;
}): string {
  return [
    input.title,
    '',
    input.summary,
    '',
    `For ${trimTrailingPunctuation(input.magazineProfile.audience)}.`,
    input.cta
  ].join('\n');
}

function createCallToAction(magazineProfile: MagazineProfile): string {
  return `Save this ${magazineProfile.id} guide and revisit it when you plan your next care routine.`;
}

function trimTrailingPunctuation(value: string): string {
  return value.trim().replace(/[.!?]+$/u, '');
}

function createAltText(
  title: string,
  magazineProfile: MagazineProfile,
  selectedImage?: ImageAsset
): string {
  if (!selectedImage) {
    return `${magazineProfile.name} editorial image for ${title}.`;
  }

  return [
    `${magazineProfile.name} editorial image for ${title}.`,
    selectedImage.metadata.description ?? selectedImage.metadata.title ?? selectedImage.metadata.filename
  ].join(' ');
}
