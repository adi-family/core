import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getArticle, getArticleSlugs } from '@/lib/articles';
import { Calendar, User, ArrowRight } from 'lucide-react';

/**
 * Page props for dynamic article page
 */
interface ArticlePageProps {
  params: Promise<{
    slug: string;
  }>;
}

/**
 * Generate static params for all articles at build time
 */
export async function generateStaticParams() {
  const slugs = getArticleSlugs();
  return slugs.map((slug) => ({
    slug,
  }));
}

/**
 * Generate metadata for individual article page
 */
export async function generateMetadata({ params }: ArticlePageProps) {
  const { slug } = await params;

  try {
    const article = await getArticle(slug);
    return {
      title: `${article.metadata.title} | ADI Simple`,
      description: article.metadata.description,
      authors: [{ name: article.metadata.author }],
      openGraph: {
        title: article.metadata.title,
        description: article.metadata.description,
        type: 'article',
        publishedTime: article.metadata.date,
        authors: [article.metadata.author],
        tags: article.metadata.tags,
      },
    };
  } catch {
    return {
      title: 'Article Not Found | ADI Simple',
    };
  }
}

/**
 * Format date string to readable format
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Individual article page component
 */
export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;

  let article;
  try {
    article = await getArticle(slug);
  } catch {
    notFound();
  }

  const { metadata, module } = article;
  const Content = module.default;

  return (
    <main className="relative w-full min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-black to-slate-900">
      {/* Animated background gradient orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 py-16 md:py-24">
        {/* Navigation */}
        <div className="mb-12 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/"
            className="text-4xl md:text-5xl font-bold tracking-wider bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent hover:opacity-80 transition-opacity duration-300"
          >
            ADI
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/articles"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm text-white/70 hover:text-white/90 bg-white/5 hover:bg-white/10 backdrop-blur-sm border border-white/10 hover:border-white/20 rounded-lg transition-all duration-300"
            >
              Articles
            </Link>
            <Link
              href={process.env.NEXT_PUBLIC_APP_URL || '/'}
              className="relative inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-blue-600 rounded-lg shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:scale-105 transition-all duration-300"
            >
              <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full shadow-lg animate-pulse">$100 Free</span>
              Activate ADI
            </Link>
          </div>
        </div>

        <article>
          {/* Article Header */}
          <header className="mb-12">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              {metadata.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-sm text-white/50 mb-6">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <time dateTime={metadata.date}>{formatDate(metadata.date)}</time>
              </div>
              <span className="text-white/20">•</span>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" />
                <span>{metadata.author}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-8">
              {metadata.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1.5 bg-gradient-to-r from-blue-500/10 to-purple-500/10 backdrop-blur-sm border border-blue-500/20 text-blue-300 rounded-lg text-xs font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>

            <p className="text-lg md:text-xl text-white/70 leading-relaxed mb-12 pb-8 border-b border-white/10">
              {metadata.description}
            </p>
          </header>

          {/* Article Content */}
          <div className="article-content">
            <Content />
          </div>

          {/* Article Footer */}
          <footer className="mt-12 pt-8 border-t border-white/10">
            <Link
              href="/articles"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm text-white/70 hover:text-white/90 bg-white/5 hover:bg-white/10 backdrop-blur-sm border border-white/10 hover:border-white/20 rounded-lg transition-all duration-300"
            >
              <ArrowRight className="w-4 h-4 rotate-180" />
              Back to articles
            </Link>
          </footer>
        </article>

        {/* Site Footer */}
        <footer className="w-full border-t border-white/10 bg-slate-950/50 backdrop-blur-sm py-8 mt-16">
          <div className="max-w-4xl mx-auto px-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              {/* Logo/Brand */}
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  ADI
                </h2>
                <span className="text-white/40 text-sm">Automated Development Intelligence</span>
              </div>

              {/* Links */}
              <div className="flex items-center gap-6 text-sm">
                <Link href="/" className="text-white/60 hover:text-white/90 transition-colors">
                  Home
                </Link>
                <Link href="/articles" className="text-white/60 hover:text-white/90 transition-colors">
                  Articles
                </Link>
                <Link href="/privacy" className="text-white/60 hover:text-white/90 transition-colors">
                  Privacy
                </Link>
                <Link href="/terms" className="text-white/60 hover:text-white/90 transition-colors">
                  Terms
                </Link>
              </div>

              {/* Copyright */}
              <div className="text-white/40 text-sm">
                © {new Date().getFullYear()} ADI
              </div>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
