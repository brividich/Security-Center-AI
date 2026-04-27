# Alert Lifecycle

Alerts move through operational states as an IT admin triages, investigates, suppresses, remediates, and closes work.

## Statuses

`new` means the system created the alert and nobody has triaged it yet.

`open` means the alert is active and requires attention.

`acknowledged` means a human has seen the alert and accepted ownership for review.

`in_progress` means remediation or investigation is underway.

`snoozed` means the alert remains valid but is temporarily hidden or deferred until a defined time.

`muted` means the alert is quieted without claiming the underlying condition is resolved.

`suppressed` means a suppression rule matched and prevented normal alert handling.

`resolved` means the underlying issue is believed fixed.

`false_positive` means the alert was incorrect or not applicable.

`closed` means operational work is complete and the alert should no longer appear in active queues.

## Action Differences

Acknowledge records that someone has seen the alert. Snooze defers a valid alert temporarily. Mute quiets a noisy alert without creating a reusable rule. A suppression rule is a reusable configuration object that prevents matching future alerts. False positive records that the alert logic or source signal was wrong. Resolved records that the issue was fixed. Closed is the final administrative state after the work is complete.

