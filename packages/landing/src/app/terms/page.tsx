import Link from 'next/link';
import type { Metadata } from 'next';

/**
 * Metadata for Terms of Use page
 */
export const metadata: Metadata = {
  title: 'Terms of Use | ADI Simple',
  description: 'Terms of use for ADI - Autonomous Development Intelligence',
};

/**
 * Terms of Use page component
 */
export default function TermsPage() {
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
            Terms of Use
          </h1>

          <p className="text-white/50 text-sm mb-12">
            Last updated: October 29, 2025
          </p>

          <div className="space-y-8 text-white/70">
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">1. Agreement to Terms</h2>
              <p>
                By accessing or using ADI (Autonomous Development Intelligence), you agree to be bound by these Terms of Use.
                ADI is operated by Ihor Herasymovych, based in Portugal. If you do not agree to these terms, do not use the service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">2. Service Description</h2>
              <p>
                ADI is an autonomous development intelligence platform that helps automate software development tasks
                by connecting to your repositories, task management systems, and AI providers.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">3. Free to Use</h2>
              <p className="mb-4">
                ADI is currently free to use. We reserve the right to introduce pricing in the future, with advance notice to users.
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Free Quota:</strong> Each account receives a free quota for service operations</li>
                <li><strong>No Hidden Fees:</strong> We do not charge for the core service functionality</li>
                <li><strong>Future Changes:</strong> Any pricing changes will be communicated at least 30 days in advance</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">4. Bring Your Own Key (BYOK)</h2>
              <p className="mb-4">
                ADI operates on a Bring Your Own Key model:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>You provide your own API keys for AI providers (Anthropic, OpenAI, Google)</li>
                <li>All AI usage costs are billed directly by the AI providers to your account</li>
                <li>We do not mark up, resell, or profit from your AI provider costs</li>
                <li>You are responsible for monitoring and managing your AI provider spending</li>
                <li>You maintain direct control over your AI usage and billing</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">5. User Responsibilities</h2>
              <p className="mb-4">You agree to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Provide accurate and complete information when creating an account</li>
                <li>Maintain the security of your account credentials and API keys</li>
                <li>Use the service in compliance with all applicable laws and regulations</li>
                <li>Not use the service for any illegal or unauthorized purpose</li>
                <li>Not attempt to gain unauthorized access to any part of the service</li>
                <li>Not interfere with or disrupt the service or servers</li>
                <li>Monitor your AI provider costs and usage</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">6. Quota and Usage Limits</h2>
              <p>
                Each account is subject to usage quotas to ensure fair access and service stability.
                We reserve the right to modify quotas and implement rate limiting as necessary.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">7. Third-Party Services</h2>
              <p className="mb-4">
                ADI integrates with third-party services. Your use of these services is subject to their respective terms:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>GitLab:</strong> Required for repository access and OAuth authentication</li>
                <li><strong>AI Providers:</strong> Anthropic (Claude), OpenAI (GPT), Google (Gemini)</li>
                <li><strong>Task Sources:</strong> Jira, Linear, GitLab Issues</li>
              </ul>
              <p className="mt-4">
                We are not responsible for the availability, functionality, or policies of third-party services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">8. Data and Privacy</h2>
              <p>
                Your use of ADI is subject to our Privacy Policy. By using the service, you consent to our
                collection and use of data as described in the Privacy Policy.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">9. Intellectual Property</h2>
              <p className="mb-4">
                You retain all rights to your code, repositories, and data. By using ADI:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>You grant us permission to access and process your data to provide the service</li>
                <li>Code generated by AI providers is subject to their respective terms and policies</li>
                <li>ADI&apos;s software, branding, and documentation remain our property</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">10. Service Availability</h2>
              <p className="mb-4">
                We strive to provide reliable service, but:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>The service is provided &quot;as is&quot; without warranties of any kind</li>
                <li>We do not guarantee uninterrupted or error-free operation</li>
                <li>We may modify, suspend, or discontinue features with notice</li>
                <li>Scheduled maintenance will be communicated in advance when possible</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">11. Limitation of Liability</h2>
              <p>
                To the maximum extent permitted by law, ADI and its operator shall not be liable for any indirect,
                incidental, special, consequential, or punitive damages, including loss of profits, data, or other
                intangible losses resulting from your use of the service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">12. AI-Generated Code</h2>
              <p className="mb-4">
                Important disclaimers about AI-generated code:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>AI-generated code should be reviewed before deployment</li>
                <li>We are not responsible for bugs, security vulnerabilities, or issues in generated code</li>
                <li>You are responsible for testing and validating all code before use in production</li>
                <li>Generated code quality depends on your AI provider and input quality</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">13. Account Termination</h2>
              <p className="mb-4">
                We reserve the right to suspend or terminate accounts that:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Violate these Terms of Use</li>
                <li>Engage in abusive or fraudulent behavior</li>
                <li>Compromise service security or stability</li>
                <li>Violate applicable laws or regulations</li>
              </ul>
              <p className="mt-4">
                You may delete your account at any time through the service settings.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">14. Changes to Terms</h2>
              <p>
                We may update these Terms of Use from time to time. Significant changes will be communicated
                via email or through the service. Continued use after changes constitutes acceptance of the new terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">15. Governing Law</h2>
              <p>
                These Terms shall be governed by and construed in accordance with the laws of Portugal,
                without regard to its conflict of law provisions.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">16. Contact Information</h2>
              <p>
                For questions about these Terms of Use, contact:
              </p>
              <p className="mt-4">
                <strong>Ihor Herasymovych</strong><br />
                Portugal<br />
                Email: <a href="mailto:support@the-ihor.com" className="text-blue-400 hover:text-blue-300">support@the-ihor.com</a>
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">17. Severability</h2>
              <p>
                If any provision of these Terms is found to be unenforceable, the remaining provisions will
                continue in full force and effect.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">18. Entire Agreement</h2>
              <p>
                These Terms of Use, together with our Privacy Policy, constitute the entire agreement between
                you and ADI regarding the use of the service.
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
