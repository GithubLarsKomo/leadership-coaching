# DESIGN — Leadership Assessment Coaching

## Intent

The UI should feel calm, credible and focused: closer to a professional assessment workspace than a quiz game. Avoid gamification, decorative scoring effects and visual signals that could change candidate behavior during measurement.

## Surfaces

### Candidate
- One task focus at a time.
- Locked state clearly explains that timing begins on unlock.
- Countdown is visible but not visually alarming until a defined threshold.
- Autosave state is explicit.
- Completion requires an intentional confirmation.
- No hidden competency names, scores or evaluator rationale during an active block.

### Coach
- Evidence first: raw answer and timing before interpretation.
- Clear distinction between system evidence, LLM-derived assessment and human revision.
- Assessment dimensions show evidence class, confidence and supporting observations, not only a numeric score.
- Trend views label retest/transfer/robustness context so unlike exercises are not presented as falsely equivalent measurements.

## Accessibility

- WCAG-oriented contrast and keyboard operation.
- No information conveyed by color alone.
- Minimum touch target 44px.
- Focus indicators remain visible.
- Candidate timer updates must not spam screen readers; announce meaningful thresholds only.
- Respect reduced-motion preference.

## Responsive behavior

Candidate view is mobile-first and must work reliably on a phone. Coach dashboards may use wider layouts but must remain functional on tablet.

## Language

Use precise, neutral German for PES/SGL content. Avoid coaching buzzwords in candidate tasks. Feedback can be direct but must cite observable behavior rather than personality labels.
