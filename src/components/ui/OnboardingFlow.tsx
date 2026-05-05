'use client'

import { useState, useEffect } from 'react'
import { X, ChevronRight } from 'lucide-react'

interface OnboardingStep {
  title: string
  description: string
  highlightSelector?: string
  position: 'center' | 'top' | 'bottom' | 'left' | 'right'
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    title: 'Welcome to ImpactGlobe',
    description:
      'Track real-time global news events and their impact on forex markets. Click any pulsing marker on the globe to see event details.',
    position: 'center',
  },
  {
    title: 'Filter & Search',
    description:
      'Use the filter bar to narrow down events by category, impact level, or search for specific countries.',
    highlightSelector: 'header',
    position: 'bottom',
  },
  {
    title: 'Create a Free Account',
    description:
      'Sign up to save watchlists, get push notifications for events in countries you care about, and access historical playback.',
    position: 'center',
  },
]

export function OnboardingFlow() {
  const [currentStep, setCurrentStep] = useState(0)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Check if user has seen onboarding
    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding')
    if (!hasSeenOnboarding) {
      setIsVisible(true)
    }
  }, [])

  useEffect(() => {
    // Handle escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleSkip()
      }
    }

    if (isVisible) {
      window.addEventListener('keydown', handleEscape)
    }

    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isVisible])

  const handleNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleComplete()
    }
  }

  const handleSkip = () => {
    localStorage.setItem('hasSeenOnboarding', 'true')
    setIsVisible(false)
  }

  const handleComplete = () => {
    localStorage.setItem('hasSeenOnboarding', 'true')
    setIsVisible(false)
  }

  if (!isVisible) return null

  const step = ONBOARDING_STEPS[currentStep]

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-fade-in" />

      {/* Onboarding card */}
      <div
        className={`fixed z-50 w-full max-w-md animate-slide-in rounded-lg border border-border-default bg-bg-card p-6 shadow-2xl ${
          step.position === 'center'
            ? 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'
            : step.position === 'top'
              ? 'left-1/2 top-24 -translate-x-1/2'
              : step.position === 'bottom'
                ? 'bottom-24 left-1/2 -translate-x-1/2'
                : step.position === 'left'
                  ? 'left-24 top-1/2 -translate-y-1/2'
                  : 'right-24 top-1/2 -translate-y-1/2'
        }`}
      >
        {/* Close button */}
        <button
          onClick={handleSkip}
          className="absolute right-4 top-4 rounded-lg p-1 text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary"
          title="Skip onboarding"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Content */}
        <div className="mb-6">
          <h2 className="mb-2 text-xl font-bold text-text-primary">{step.title}</h2>
          <p className="text-sm leading-relaxed text-text-secondary">{step.description}</p>
        </div>

        {/* Progress dots */}
        <div className="mb-6 flex items-center justify-center gap-2">
          {ONBOARDING_STEPS.map((_, index) => (
            <div
              key={index}
              className={`h-2 w-2 rounded-full transition-all ${
                index === currentStep
                  ? 'w-6 bg-impact-medium'
                  : index < currentStep
                    ? 'bg-impact-medium/50'
                    : 'bg-bg-elevated'
              }`}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={handleSkip}
            className="rounded-lg px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:text-text-secondary"
          >
            Skip
          </button>
          <button
            onClick={handleNext}
            className="flex items-center gap-2 rounded-lg bg-impact-medium px-6 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-impact-medium/80"
          >
            {currentStep < ONBOARDING_STEPS.length - 1 ? (
              <>
                Next
                <ChevronRight className="h-4 w-4" />
              </>
            ) : (
              'Get Started'
            )}
          </button>
        </div>
      </div>
    </>
  )
}
