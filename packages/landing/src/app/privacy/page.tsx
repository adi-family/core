import Link from 'next/link';
import type { Metadata } from 'next';

/**
 * Metadata for Privacy Policy page
 */
export const metadata: Metadata = {
  title: 'Privacy Policy | ADI Simple',
  description: 'Privacy policy for ADI - Autonomous Development Intelligence',
};

/**
 * Privacy Policy page component
 */
export default function PrivacyPage() {
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

        <article className="prose prose-invert prose-lg max-w-none">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-8 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Privacy Policy
          </h1>

          <p className="text-white/50 text-sm mb-12">
            Last updated: October 29, 2025
          </p>

          <div className="space-y-8 text-white/70">
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">1. Introduction</h2>
              <p>
                ADI (Autonomous Development Intelligence) is operated by Ihor Herasymovych, based in Portugal.
                This Privacy Policy explains how we collect, use, and protect your personal information when you use our service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">2. Information We Collect</h2>
              <p className="mb-4">We collect the following types of information:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Account Information:</strong> Email address, GitLab username, and OAuth tokens when you connect your GitLab account</li>
                <li><strong>API Keys:</strong> AI provider API keys (Anthropic, OpenAI, Google) that you provide for the service to function</li>
                <li><strong>Repository Data:</strong> Code, issues, merge requests, and CI/CD information from your GitLab repositories</li>
                <li><strong>Task Source Data:</strong> Tasks and issues from connected services (Jira, Linear, GitLab)</li>
                <li><strong>Usage Data:</strong> Service usage metrics, API calls, and operational logs</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">3. How We Use Your Information</h2>
              <p className="mb-4">We use your information to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Provide and operate the ADI service</li>
                <li>Authenticate and authorize access to connected services</li>
                <li>Process tasks and generate code implementations</li>
                <li>Monitor service usage and enforce quota limits</li>
                <li>Improve service performance and user experience</li>
                <li>Communicate service updates and important notices</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">4. Data Storage and Security</h2>
              <p className="mb-4">We take security seriously:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Encryption:</strong> All API keys and sensitive data are encrypted at rest</li>
                <li><strong>OAuth:</strong> We use OAuth 2.0 for GitLab authentication - we never see your password</li>
                <li><strong>Access Control:</strong> Your data is only accessible to the service processes that need it</li>
                <li><strong>Third-Party AI:</strong> Code and tasks are sent to AI providers (Anthropic, OpenAI, Google) using your API keys</li>
              </ul>
              <p className="mt-4">
                Note: When using AI providers, your code and task data is processed according to their respective privacy policies.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">5. Data Sharing</h2>
              <p className="mb-4">We share your data only in these circumstances:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>AI Providers:</strong> Code and tasks are sent to AI services using your API keys</li>
                <li><strong>GitLab:</strong> We access your repositories through GitLab&apos;s API with your authorization</li>
                <li><strong>Task Sources:</strong> We fetch tasks from connected services (Jira, Linear) with your authorization</li>
                <li><strong>Legal Requirements:</strong> If required by law or to protect rights and safety</li>
              </ul>
              <p className="mt-4">
                We do not sell or rent your personal information to third parties.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">6. Your API Keys and Costs</h2>
              <p>
                ADI operates on a Bring Your Own Key (BYOK) model. You provide your own AI provider API keys,
                and all AI usage costs are charged directly by the AI providers to your account. We do not mark up
                or profit from your AI usage costs.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">7. Free Quota</h2>
              <p>
                Each account receives a free quota for service operations. This quota is separate from your AI
                provider costs and covers ADI&apos;s infrastructure and processing.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">8. Your Rights</h2>
              <p className="mb-4">You have the right to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Access your personal data stored in our system</li>
                <li>Request correction of inaccurate data</li>
                <li>Request deletion of your account and data</li>
                <li>Revoke OAuth permissions at any time through GitLab settings</li>
                <li>Export your data (where technically feasible)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">9. Data Retention</h2>
              <p>
                We retain your data for as long as your account is active. When you delete your account,
                we remove your personal data within 30 days, except where required to retain it for legal obligations.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">10. Children&apos;s Privacy</h2>
              <p>
                ADI is not intended for use by individuals under 18 years of age. We do not knowingly collect
                personal information from children.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">11. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. We will notify you of significant changes
                via email or through the service. Continued use after changes constitutes acceptance.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">12. Contact</h2>
              <p>
                For privacy concerns or questions, contact:
              </p>
              <p className="mt-4">
                <strong>Ihor Herasymovych</strong><br />
                Portugal<br />
                Email: <a href="mailto:support@the-ihor.com" className="text-blue-400 hover:text-blue-300">support@the-ihor.com</a>
              </p>
            </section>
          </div>
        </article>

        {/* Footer */}
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
