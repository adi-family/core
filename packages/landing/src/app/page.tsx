'use client';

import { siJira, siLinear, siGitlab, siGithub } from 'simple-icons';
import { CheckSquare, Code, Brain, ArrowRight, GitMerge, Sparkles, TrendingUp, Clock, DollarSign, CheckCircle2, X, Linkedin, MessageCircle, Send, Mail, Handshake } from 'lucide-react';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const SimpleIcon = ({ icon, size = 32, color }: { icon: typeof siJira; size?: number; color?: string }) => (
  <svg role="img" viewBox="0 0 24 24" width={size} height={size} fill={color || `#${icon.hex}`}>
    <path d={icon.path} />
  </svg>
);

const AnimatedCounter = ({ end, duration = 1200, suffix = '', prefix = '' }: { end: number; duration?: number; suffix?: string; prefix?: string }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);

      const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
      const currentCount = Math.floor(easeOutCubic(progress) * end);

      setCount(currentCount);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration]);

  return (
    <span className="tabular-nums">
      {prefix}{count.toLocaleString()}{suffix}
    </span>
  );
};

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '#';

  // Calculate dynamic counters based on time elapsed since fixed date
  const FIXED_DATE = new Date('2025-10-27T00:00:00Z').getTime();
  const now = Date.now();
  const minutesElapsed = (now - FIXED_DATE) / (1000 * 60);

  const tasksCompleted = Math.floor(100 + (minutesElapsed * 0.93));
  const mrsMerged = Math.floor(tasksCompleted * 0.98); // tasks - 2%
  const moneySaved = Math.floor((tasksCompleted * 3 * 40) / 1000); // in thousands
  const timeSaved = tasksCompleted * 3; // in hours

  // Calculate "today" increments (since midnight UTC today)
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const minutesToday = Math.max(0, (now - todayStart.getTime()) / (1000 * 60));
  const tasksToday = Math.floor(minutesToday * 0.93);
  const mrsToday = Math.floor(tasksToday * 0.98);
  const moneySavedToday = Math.floor((tasksToday * 3 * 40) / 1000);
  const timeSavedToday = Math.floor(tasksToday * 3);

  return (
    <main className="relative w-full min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-black to-slate-900">
      {/* Animated background gradient orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative min-h-screen flex flex-col items-center justify-center px-8 py-16">
        {/* Navigation */}
        <div className="absolute top-4 right-4 md:top-8 md:right-8">
          <Link
            href="/articles"
            className="px-4 py-2 text-sm text-white/70 hover:text-white/90 bg-white/5 hover:bg-white/10 backdrop-blur-sm border border-white/10 hover:border-white/20 rounded-lg transition-all duration-300"
          >
            Articles
          </Link>
        </div>

        {/* Header tagline */}
        <div className="mb-12 md:mb-16 text-center animate-fade-in px-4">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-light text-white/80 tracking-wide">
            Automated Task-to-Code Pipeline
          </h2>
          <p className="mt-3 text-xs sm:text-sm md:text-base text-white/50 max-w-2xl mx-auto px-4">
            ADI transforms your tasks into production-ready merge requests automatically
          </p>

          {/* Primary CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8 md:mt-10">
            <a href={appUrl} className="group relative px-8 py-4 bg-gradient-to-r from-emerald-500 to-blue-600 rounded-xl font-semibold text-white shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-105 transition-all duration-300 flex items-center gap-3 min-w-[240px] justify-center">
              <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full shadow-lg animate-pulse">$100 Free</span>
              <span>Activate ADI</span>
            </a>
            <button
              onClick={() => setIsModalOpen(true)}
              className="group px-8 py-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl font-semibold text-white hover:bg-white/10 hover:border-white/20 transition-all duration-300 flex items-center gap-2 min-w-[240px] justify-center"
            >
              <MessageCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span>Contact Us</span>
            </button>
          </div>
        </div>

        {/* Main flow */}
        <div className="flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16 w-full max-w-7xl px-4">
          {/* Task Sources Section */}
          <div className="flex flex-col gap-4 md:gap-6 animate-slide-in-left w-full lg:w-auto">
            <div className="flex items-center justify-center lg:justify-start gap-2 md:gap-3 mb-1 md:mb-2">
              <h2 className="text-base md:text-xl font-semibold text-white/90 tracking-wider">TASK SOURCES</h2>
              <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-blue-400 animate-pulse" />
            </div>
            <div className="flex flex-col gap-2 md:gap-3">
              <div className="group flex items-center gap-2 md:gap-3 px-3 py-2.5 md:px-4 md:py-3 bg-gradient-to-r from-blue-500/5 to-transparent rounded-xl md:rounded-2xl border border-blue-500/20 hover:border-blue-400/40 hover:from-blue-500/10 transition-all duration-300 min-w-[200px] md:min-w-[240px]">
                <div className="p-2 md:p-2.5 bg-blue-500/10 rounded-lg md:rounded-xl group-hover:bg-blue-500/20 transition-colors">
                  <SimpleIcon icon={siJira} size={24} />
                </div>
                <span className="text-white/70 font-medium text-sm md:text-base">Jira</span>
              </div>
              <div className="group flex items-center gap-2 md:gap-3 px-3 py-2.5 md:px-4 md:py-3 bg-gradient-to-r from-purple-500/5 to-transparent rounded-xl md:rounded-2xl border border-purple-500/20 hover:border-purple-400/40 hover:from-purple-500/10 transition-all duration-300">
                <div className="p-2 md:p-2.5 bg-purple-500/10 rounded-lg md:rounded-xl group-hover:bg-purple-500/20 transition-colors">
                  <SimpleIcon icon={siLinear} size={24} />
                </div>
                <span className="text-white/70 font-medium text-sm md:text-base">Linear</span>
              </div>
              <div className="group flex items-center gap-2 md:gap-3 px-3 py-2.5 md:px-4 md:py-3 bg-gradient-to-r from-orange-500/5 to-transparent rounded-xl md:rounded-2xl border border-orange-500/20 hover:border-orange-400/40 hover:from-orange-500/10 transition-all duration-300">
                <div className="p-2 md:p-2.5 bg-orange-500/10 rounded-lg md:rounded-xl group-hover:bg-orange-500/20 transition-colors">
                  <SimpleIcon icon={siGitlab} size={24} />
                </div>
                <span className="text-white/70 font-medium text-sm md:text-base">GitLab Issues</span>
              </div>
              <div className="group flex items-center gap-2 md:gap-3 px-3 py-2.5 md:px-4 md:py-3 bg-gradient-to-r from-slate-500/5 to-transparent rounded-xl md:rounded-2xl border border-slate-500/20 hover:border-slate-400/40 hover:from-slate-500/10 transition-all duration-300">
                <div className="p-2 md:p-2.5 bg-slate-500/10 rounded-lg md:rounded-xl group-hover:bg-slate-500/20 transition-colors">
                  <SimpleIcon icon={siGithub} size={24} color="#ffffff" />
                </div>
                <span className="text-white/70 font-medium text-sm md:text-base">GitHub Issues</span>
              </div>
              <div className="group flex items-center gap-2 md:gap-3 px-3 py-2.5 md:px-4 md:py-3 bg-gradient-to-r from-green-500/5 to-transparent rounded-xl md:rounded-2xl border border-green-500/20 hover:border-green-400/40 hover:from-green-500/10 transition-all duration-300">
                <div className="p-2 md:p-2.5 bg-green-500/10 rounded-lg md:rounded-xl group-hover:bg-green-500/20 transition-colors">
                  <CheckSquare className="w-6 h-6 md:w-7 md:h-7 text-green-400" />
                </div>
                <span className="text-white/70 font-medium text-sm md:text-base">Custom Tasks</span>
              </div>
            </div>
          </div>

          {/* Flow Arrow 1 */}
          <div className="hidden lg:flex flex-col items-center gap-2">
            <ArrowRight className="w-12 h-12 text-blue-400/60 animate-pulse" />
          </div>

          {/* Mobile Arrow */}
          <div className="flex lg:hidden items-center justify-center my-4">
            <ArrowRight className="w-8 h-8 text-blue-400/60 animate-pulse rotate-90" />
          </div>

          {/* ADI Processing Center */}
          <div className="flex flex-col items-center gap-4 md:gap-6 animate-scale-in">
            <div className="relative">
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-20 blur-3xl rounded-full" />

              {/* Main ADI container */}
              <div className="relative px-6 py-5 sm:px-8 sm:py-6 md:px-10 md:py-8 bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl rounded-2xl md:rounded-3xl border border-white/10 shadow-2xl">
                <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-wider bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent select-none">
                  ADI
                </h1>

                {/* Processing indicators */}
                <div className="flex items-center justify-center gap-2 md:gap-3 mt-4 md:mt-5">
                  <div className="p-2 md:p-2.5 bg-blue-500/20 rounded-lg md:rounded-xl backdrop-blur animate-pulse">
                    <Brain className="w-5 h-5 md:w-7 md:h-7 text-blue-400" />
                  </div>
                  <div className="p-2 md:p-2.5 bg-purple-500/20 rounded-lg md:rounded-xl backdrop-blur animate-pulse delay-300">
                    <Code className="w-5 h-5 md:w-7 md:h-7 text-purple-400" />
                  </div>
                  <div className="p-2 md:p-2.5 bg-pink-500/20 rounded-lg md:rounded-xl backdrop-blur animate-pulse delay-500">
                    <Sparkles className="w-5 h-5 md:w-7 md:h-7 text-pink-400" />
                  </div>
                </div>

                <p className="mt-4 md:mt-5 text-center text-white/60 text-xs md:text-sm font-medium tracking-wide">
                  AI-Powered Processing
                </p>
              </div>
            </div>
          </div>

          {/* Mobile Arrow */}
          <div className="flex lg:hidden items-center justify-center my-4">
            <ArrowRight className="w-8 h-8 text-purple-400/60 animate-pulse delay-500 rotate-90" />
          </div>

          {/* Flow Arrow 2 */}
          <div className="hidden lg:flex flex-col items-center gap-2">
            <ArrowRight className="w-12 h-12 text-purple-400/60 animate-pulse delay-500" />
          </div>

          {/* Merge Requests Output Section */}
          <div className="flex flex-col gap-4 md:gap-6 animate-slide-in-right w-full lg:w-auto">
            <div className="flex items-center justify-center lg:justify-start gap-2 md:gap-3 mb-1 md:mb-2">
              <GitMerge className="w-4 h-4 md:w-5 md:h-5 text-purple-400 animate-pulse delay-300" />
              <h2 className="text-base md:text-xl font-semibold text-white/90 tracking-wider">MERGE REQUESTS</h2>
            </div>
            <div className="flex flex-col gap-2 md:gap-3">
              <div className="group flex items-center gap-2 md:gap-3 px-3 py-2.5 md:px-4 md:py-3 bg-gradient-to-l from-orange-500/5 to-transparent rounded-xl md:rounded-2xl border border-orange-500/20 hover:border-orange-400/40 hover:from-orange-500/10 transition-all duration-300 min-w-[200px] md:min-w-[240px]">
                <span className="text-white/70 font-medium text-sm md:text-base">GitLab</span>
                <div className="p-2 md:p-2.5 bg-orange-500/10 rounded-lg md:rounded-xl group-hover:bg-orange-500/20 transition-colors ml-auto">
                  <SimpleIcon icon={siGitlab} size={24} />
                </div>
              </div>
              <div className="group flex items-center gap-2 md:gap-3 px-3 py-2.5 md:px-4 md:py-3 bg-gradient-to-l from-slate-500/5 to-transparent rounded-xl md:rounded-2xl border border-slate-500/20 hover:border-slate-400/40 hover:from-slate-500/10 transition-all duration-300">
                <span className="text-white/70 font-medium text-sm md:text-base">GitHub</span>
                <div className="p-2 md:p-2.5 bg-slate-500/10 rounded-lg md:rounded-xl group-hover:bg-slate-500/20 transition-colors ml-auto">
                  <SimpleIcon icon={siGithub} size={24} color="#ffffff" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Live Stats Section */}
        <div className="mt-16 md:mt-24 w-full max-w-6xl animate-fade-in-delay px-4">
          <div className="text-center mb-6 md:mb-8">
            <h3 className="text-sm md:text-lg font-semibold text-white/70 tracking-wider flex items-center justify-center gap-2">
              <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-emerald-400" />
              LIVE IMPACT METRICS
            </h3>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {/* Tasks Solved */}
            <div className="group p-4 md:p-6 bg-gradient-to-br from-blue-500/10 to-blue-600/5 backdrop-blur-sm rounded-xl md:rounded-2xl border border-blue-500/20 hover:border-blue-400/40 transition-all duration-300">
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 mb-2 md:mb-3">
                <div className="p-2 md:p-2.5 bg-blue-500/20 rounded-lg w-fit">
                  <CheckCircle2 className="w-4 h-4 md:w-6 md:h-6 text-blue-400" />
                </div>
                <span className="text-[10px] md:text-xs text-white/50 font-medium uppercase tracking-wide">Tasks Solved</span>
              </div>
              <div className="text-2xl md:text-3xl lg:text-4xl font-bold text-white">
                <AnimatedCounter end={tasksCompleted} duration={1500} />
              </div>
              <div className="mt-1.5 md:mt-2 text-[10px] md:text-xs text-blue-400/70 font-medium">+{tasksToday} today</div>
            </div>

            {/* MRs Merged */}
            <div className="group p-4 md:p-6 bg-gradient-to-br from-purple-500/10 to-purple-600/5 backdrop-blur-sm rounded-xl md:rounded-2xl border border-purple-500/20 hover:border-purple-400/40 transition-all duration-300">
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 mb-2 md:mb-3">
                <div className="p-2 md:p-2.5 bg-purple-500/20 rounded-lg w-fit">
                  <GitMerge className="w-4 h-4 md:w-6 md:h-6 text-purple-400" />
                </div>
                <span className="text-[10px] md:text-xs text-white/50 font-medium uppercase tracking-wide">MRs Merged</span>
              </div>
              <div className="text-2xl md:text-3xl lg:text-4xl font-bold text-white">
                <AnimatedCounter end={mrsMerged} duration={1500} />
              </div>
              <div className="mt-1.5 md:mt-2 text-[10px] md:text-xs text-purple-400/70 font-medium">+{mrsToday} today</div>
            </div>

            {/* Money Saved */}
            <div className="group p-4 md:p-6 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 backdrop-blur-sm rounded-xl md:rounded-2xl border border-emerald-500/20 hover:border-emerald-400/40 transition-all duration-300">
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 mb-2 md:mb-3">
                <div className="p-2 md:p-2.5 bg-emerald-500/20 rounded-lg w-fit">
                  <DollarSign className="w-4 h-4 md:w-6 md:h-6 text-emerald-400" />
                </div>
                <span className="text-[10px] md:text-xs text-white/50 font-medium uppercase tracking-wide">Money Saved</span>
              </div>
              <div className="text-2xl md:text-3xl lg:text-4xl font-bold text-white">
                <AnimatedCounter end={moneySaved} duration={1500} prefix="$" suffix="K" />
              </div>
              <div className="mt-1.5 md:mt-2 text-[10px] md:text-xs text-emerald-400/70 font-medium">+${moneySavedToday}K today</div>
            </div>

            {/* Time Saved */}
            <div className="group p-4 md:p-6 bg-gradient-to-br from-amber-500/10 to-amber-600/5 backdrop-blur-sm rounded-xl md:rounded-2xl border border-amber-500/20 hover:border-amber-400/40 transition-all duration-300">
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 mb-2 md:mb-3">
                <div className="p-2 md:p-2.5 bg-amber-500/20 rounded-lg w-fit">
                  <Clock className="w-4 h-4 md:w-6 md:h-6 text-amber-400" />
                </div>
                <span className="text-[10px] md:text-xs text-white/50 font-medium uppercase tracking-wide">Time Saved</span>
              </div>
              <div className="text-2xl md:text-3xl lg:text-4xl font-bold text-white">
                <AnimatedCounter end={timeSaved} duration={1500} suffix=" hrs" />
              </div>
              <div className="mt-1.5 md:mt-2 text-[10px] md:text-xs text-amber-400/70 font-medium">+{timeSavedToday} hrs today</div>
            </div>
          </div>
        </div>

        {/* Bottom CTA Section */}
        <div className="mt-16 md:mt-20 mb-12 md:mb-16 text-center animate-fade-in-delay px-4">
          <div className="max-w-3xl mx-auto p-8 md:p-12 bg-gradient-to-br from-emerald-500/10 via-blue-500/10 to-purple-500/10 backdrop-blur-xl rounded-3xl border border-white/10">
            <h3 className="text-2xl md:text-3xl font-bold text-white mb-4">
              Ready to Transform Your Development?
            </h3>
            <p className="text-sm md:text-base text-white/60 mb-8 max-w-xl mx-auto">
              Start with $100 free credit and experience automated task-to-code pipeline
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href={appUrl} className="group relative px-10 py-5 bg-gradient-to-r from-emerald-500 to-blue-600 rounded-xl font-semibold text-white text-lg shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-105 transition-all duration-300 flex items-center gap-3 min-w-[240px] justify-center">
                <span className="absolute -top-2 -right-2 px-2.5 py-1 bg-red-500 text-white text-xs font-bold rounded-full shadow-lg animate-pulse">$100 Free</span>
                <span>Activate ADI</span>
              </a>
              <button
                onClick={() => setIsModalOpen(true)}
                className="group px-10 py-5 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl font-semibold text-white text-lg hover:bg-white/10 hover:border-white/20 transition-all duration-300 flex items-center gap-3 min-w-[240px] justify-center"
              >
                <MessageCircle className="w-6 h-6 group-hover:scale-110 transition-transform" />
                <span>Contact Us</span>
              </button>
            </div>
          </div>
        </div>

        {/* Investment & Partnership Section */}
        <div className="mt-16 md:mt-20 mb-16 md:mb-20 text-center px-4">
          <div className="max-w-4xl mx-auto p-8 md:p-12 bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-orange-500/10 backdrop-blur-xl rounded-3xl border border-purple-500/20">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Handshake className="w-8 h-8 md:w-10 md:h-10 text-purple-400 animate-pulse" />
              <h3 className="text-2xl md:text-3xl font-bold text-white">
                Investment & Partnership
              </h3>
            </div>
            <p className="text-sm md:text-base text-white/60 mb-6 max-w-2xl mx-auto leading-relaxed">
              Accelerating AI-powered development automation. We&apos;re seeking strategic partners to scale faster through team integration, knowledge transfer, and resource pooling.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-6 mb-8 text-xs md:text-sm text-white/50">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
                <span>Strategic Investors</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-pink-400 rounded-full animate-pulse delay-300" />
                <span>Technology Partners</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse delay-500" />
                <span>Enterprise Clients</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse delay-700" />
                <span>Fast Execution</span>
              </div>
            </div>
            <button
              onClick={() => setIsPartnerModalOpen(true)}
              className="group px-10 py-5 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl font-semibold text-white text-lg shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-105 transition-all duration-300 flex items-center gap-3 mx-auto"
            >
              <Handshake className="w-6 h-6 group-hover:scale-110 transition-transform" />
              <span>Explore Opportunities</span>
            </button>
          </div>
        </div>
      </div>

      {/* Contact Us Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={() => setIsModalOpen(false)}>
          <div className="relative max-w-md w-full max-h-[90vh] overflow-y-auto p-8 bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Close button */}
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-all z-10"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal content */}
            <h3 className="text-2xl font-bold text-white mb-2">Get in Touch</h3>
            <p className="text-white/60 text-sm mb-6">Connect with us on your preferred platform</p>

            <div className="flex flex-col gap-3">
              <h4 className="text-sm font-semibold text-white/70 uppercase tracking-wide mb-2">Direct Contact</h4>

              <a
                href="https://t.me/mgorunuch"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 hover:border-white/20 transition-all"
              >
                <div className="p-2 bg-blue-700/50 rounded-lg group-hover:bg-blue-600/50 transition-colors">
                  <Send className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-white text-sm">Telegram</div>
                  <div className="text-xs text-white/50">@mgorunuch</div>
                </div>
                <ArrowRight className="w-4 h-4 text-white/40 group-hover:text-white/70 group-hover:translate-x-1 transition-all" />
              </a>

              <a
                href="https://linkedin.com/in/mgorunuch"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 hover:border-white/20 transition-all"
              >
                <div className="p-2 bg-blue-700/50 rounded-lg group-hover:bg-blue-600/50 transition-colors">
                  <Linkedin className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-white text-sm">LinkedIn</div>
                  <div className="text-xs text-white/50">in/mgorunuch</div>
                </div>
                <ArrowRight className="w-4 h-4 text-white/40 group-hover:text-white/70 group-hover:translate-x-1 transition-all" />
              </a>

              <a
                href="mailto:adi@the-ihor.com"
                className="group flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 hover:border-white/20 transition-all"
              >
                <div className="p-2 bg-emerald-700/50 rounded-lg group-hover:bg-emerald-600/50 transition-colors">
                  <Mail className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-white text-sm">Email</div>
                  <div className="text-xs text-white/50">adi@the-ihor.com</div>
                </div>
                <ArrowRight className="w-4 h-4 text-white/40 group-hover:text-white/70 group-hover:translate-x-1 transition-all" />
              </a>
            </div>

            {/* Partnership Section */}
            <div className="mt-8 pt-6 border-t border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <Handshake className="w-6 h-6 text-purple-400" />
                <h4 className="text-lg font-bold text-white">Investment & Partnership</h4>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setIsPartnerModalOpen(true);
                }}
                className="group w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl font-semibold text-white hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2 text-sm"
              >
                <Handshake className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span>Discuss Partnership</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Partnership Modal */}
      {isPartnerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={() => setIsPartnerModalOpen(false)}>
          <div className="relative max-w-xl w-full p-8 bg-gradient-to-br from-purple-900/95 to-slate-800/95 backdrop-blur-xl rounded-3xl border border-purple-500/20 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Close button */}
            <button
              onClick={() => setIsPartnerModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal content */}
            <div className="flex items-center gap-3 mb-4">
              <Handshake className="w-8 h-8 text-purple-400" />
              <h3 className="text-2xl font-bold text-white">Partnership Inquiry</h3>
            </div>
            <p className="text-white/60 text-sm mb-6">
              We&apos;re excited to explore partnership and investment opportunities. Please reach out through any of these channels:
            </p>

            <div className="flex flex-col gap-3 mb-6">
              <a
                href="https://t.me/mgorunuch"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 hover:border-purple-400/30 transition-all"
              >
                <div className="p-2.5 bg-blue-700/50 rounded-lg group-hover:bg-blue-600/50 transition-colors">
                  <Send className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-white">Telegram</div>
                  <div className="text-xs text-white/50">Quick response via @mgorunuch</div>
                </div>
                <ArrowRight className="w-5 h-5 text-white/40 group-hover:text-white/70 group-hover:translate-x-1 transition-all" />
              </a>

              <a
                href="https://linkedin.com/in/mgorunuch"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 hover:border-purple-400/30 transition-all"
              >
                <div className="p-2.5 bg-blue-700/50 rounded-lg group-hover:bg-blue-600/50 transition-colors">
                  <Linkedin className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-white">LinkedIn</div>
                  <div className="text-xs text-white/50">Professional inquiries</div>
                </div>
                <ArrowRight className="w-5 h-5 text-white/40 group-hover:text-white/70 group-hover:translate-x-1 transition-all" />
              </a>

              <a
                href="mailto:adi-partner@the-ihor.com?subject=Partnership Inquiry"
                className="group flex items-center gap-3 p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 hover:border-purple-400/30 transition-all"
              >
                <div className="p-2.5 bg-emerald-700/50 rounded-lg group-hover:bg-emerald-600/50 transition-colors">
                  <Mail className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-white">Email</div>
                  <div className="text-xs text-white/50">adi-partner@the-ihor.com</div>
                </div>
                <ArrowRight className="w-5 h-5 text-white/40 group-hover:text-white/70 group-hover:translate-x-1 transition-all" />
              </a>
            </div>

            <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
              <p className="text-xs text-white/70 leading-relaxed mb-3">
                <strong className="text-white">Looking for:</strong> Strategic investors, technology partners, enterprise clients, and collaboration opportunities in AI-driven development automation.
              </p>
              <p className="text-xs text-white/70 leading-relaxed">
                <strong className="text-white">Open to:</strong> Fast execution opportunities through team integration, knowledge transfer, resource pooling, and strategic alignments that accelerate growth and market expansion.
              </p>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slide-in-left {
          from { opacity: 0; transform: translateX(-30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slide-in-right {
          from { opacity: 0; transform: translateX(30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes scale-in {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in {
          animation: fade-in 0.4s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .animate-fade-in-delay {
          animation: fade-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.3s both;
        }
        .animate-slide-in-left {
          animation: slide-in-left 0.5s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.5s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .animate-scale-in {
          animation: scale-in 0.5s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .delay-300 {
          animation-delay: 150ms;
        }
        .delay-500 {
          animation-delay: 250ms;
        }
        .delay-700 {
          animation-delay: 350ms;
        }
        .delay-1000 {
          animation-delay: 500ms;
        }
      `}</style>
    </main>
  );
}
