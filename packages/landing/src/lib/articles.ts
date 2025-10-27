import fs from 'fs';
import path from 'path';

/**
 * Metadata structure for article frontmatter
 */
export interface ArticleMetadata {
  title: string;
  description: string;
  date: string;
  author: string;
  tags: string[];
  slug: string;
  image?: string;
}

/**
 * Article data including metadata and module
 */
export interface Article {
  metadata: ArticleMetadata;
  module: any;
}

const articlesDirectory = path.join(process.cwd(), 'src/content/articles');

/**
 * Get all article slugs from the content directory
 */
export function getArticleSlugs(): string[] {
  if (!fs.existsSync(articlesDirectory)) {
    return [];
  }

  const files = fs.readdirSync(articlesDirectory);
  return files
    .filter((file) => file.endsWith('.mdx'))
    .map((file) => file.replace(/\.mdx$/, ''));
}

/**
 * Load a single article by slug
 */
export async function getArticle(slug: string): Promise<Article> {
  const articleModule = await import(`@/content/articles/${slug}.mdx`);

  return {
    metadata: {
      ...articleModule.metadata,
      slug,
    },
    module: articleModule,
  };
}

/**
 * Get all articles sorted by date (newest first)
 */
export async function getAllArticles(): Promise<Article[]> {
  const slugs = getArticleSlugs();
  const articles = await Promise.all(slugs.map((slug) => getArticle(slug)));

  return articles.sort((a, b) => {
    const dateA = new Date(a.metadata.date);
    const dateB = new Date(b.metadata.date);
    return dateB.getTime() - dateA.getTime();
  });
}

/**
 * Get articles filtered by tag
 */
export async function getArticlesByTag(tag: string): Promise<Article[]> {
  const articles = await getAllArticles();
  return articles.filter((article) =>
    article.metadata.tags.includes(tag)
  );
}
