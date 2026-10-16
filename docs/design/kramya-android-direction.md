# Kramya Android design direction

The patient app should make the next step and the uncertainty of waiting easy to understand. This pass gives Kramya its own colour identity and more recognisable Android navigation. The final device and workflow review is tracked in [TESTING.md](../../TESTING.md), as requested by the founder.

- Deep teal (`#0D6259`) identifies primary actions, the wordmark, navigation selection and information. Warm off-white (`#F6F8F4`) and white surfaces support long reading. Apricot is a restrained decorative accent; green/amber/red retain their explicit state labels.
- Selected tabs have a tonal indicator and selected accessibility semantics. Forward, back and tab navigation explicitly use no enter/exit transitions. Loading indicators still describe actual network work; removing a fade does not remove network latency.
- Tighter screen gutters, restrained title sizes, a quieter card shadow and rectangular primary controls make room for clinic/session information. The clinic hero has a branded fallback instead of a large grey missing-photo block.
- Discover says “Find your clinic” and counts clinics taking registrations. City selection is not precise geolocation, so the copy does not claim measured proximity.
- Keep ETA, doctor availability and stale/offline warnings readable. Never infer guaranteed appointment times from colour, and never use colour as the only state signal.

This is a first implementation, not a completed visual acceptance review. Check font scaling, long clinic names, contrast, TalkBack, empty/error/loading screens and every authentication/booking/visit state on the final phone build. Web/Android brand alignment and the complete workflow review remain final-phase items.
