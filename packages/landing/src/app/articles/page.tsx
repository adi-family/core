import Link from 'next/link';
import Image from 'next/image';
import { getAllArticles } from '@/lib/articles';
import { Calendar, User, ArrowRight, Sparkles } from 'lucide-react';

/**
 * Generate metadata for the articles listing page
 */
export const metadata = {
  title: 'Articles | ADI Simple',
  description: 'Browse our collection of articles about ADI Simple, tutorials, and best practices',
};

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
 * Articles listing page component
 */
export default async function ArticlesPage() {
  const articles = await getAllArticles();

  return (
    <main className="relative w-full min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-black to-slate-900">
      {/* Animated background gradient orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 right-1/3 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
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

        {/* Header */}
        <header className="mb-16 text-center">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Articles
          </h1>
          <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto">
            Tutorials, guides, and best practices for building with ADI Simple
          </p>
        </header>

        {articles.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <p className="text-white/60">
                No articles found. Check back soon!
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-12 md:space-y-16">
            {articles.map((article, index) => (
              <Link
                key={article.metadata.slug}
                href={`/articles/${article.metadata.slug}`}
              >
                <article
                  className="group p-6 md:p-8 rounded-xl transition-all duration-300 hover:bg-white/5 hover:backdrop-blur-sm cursor-pointer flex gap-6"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex-1">
                    <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
                      {article.metadata.title}
                    </h2>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-white/50 mb-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <time dateTime={article.metadata.date}>
                          {formatDate(article.metadata.date)}
                        </time>
                      </div>
                      <span className="text-white/20">•</span>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        <span>{article.metadata.author}</span>
                      </div>
                    </div>

                    <p className="text-white/70 text-base md:text-lg leading-relaxed mb-6">
                      {article.metadata.description}
                    </p>

                    {article.metadata.tags && article.metadata.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-6">
                        {article.metadata.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-3 py-1.5 bg-blue-500/10 text-blue-300 rounded text-xs font-medium"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="inline-flex items-center gap-2 text-blue-400 group-hover:text-blue-300 font-medium transition-colors duration-300">
                      Read article
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>

                  {article.metadata.image && (
                    <div className="relative w-64 md:w-80 h-full min-h-[300px] flex-shrink-0 rounded-lg overflow-hidden">
                      <Image
                        src={article.metadata.image}
                        alt={article.metadata.title}
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                </article>
              </Link>
            ))}
          </div>
        )}

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
