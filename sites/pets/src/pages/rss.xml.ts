import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context: { site: URL | undefined }) {
  const articles = (await getCollection('articles'))
    .sort((a, b) => b.data.publishedAt.valueOf() - a.data.publishedAt.valueOf());

  return rss({
    title: 'Asteria Pets',
    description: '반려동물과 더 잘 살아가기 위한 실용적인 가이드',
    site: context.site!,
    items: articles.map((article) => ({
      title: article.data.title,
      description: article.data.description,
      pubDate: article.data.publishedAt,
      link: `/articles/${article.id}/`,
      categories: [article.data.categoryLabel]
    })),
    customData: '<language>ko-KR</language>'
  });
}
