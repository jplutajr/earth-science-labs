# Adding future Earth Science labs

Keep this balloon lab complete and usable while adding one independently reviewed activity at a time.

## Proposed sequence

These are plans, not currently available simulations.

| Candidate | Virtual action and evidence | Needed before development |
| --- | --- | --- |
| Earthquake epicenter | Read seismograms, measure S–P intervals, locate overlapping distance circles | Original lab directions, reference-table version, intended reading supports |
| Plate boundaries | Change plate motion and record patterns of quakes, volcanism, and landforms | Specific source activity and misconception review |
| Climate and energy | Vary one energy-balance factor and compare a temperature data series | Source model, units, assumptions, teacher-selected variables |
| Relative dating | Arrange strata and explain superposition and cross-cutting evidence | Original diagrams or permission to make new equivalents |

Prioritize the next assigned lab from the shared curriculum, not the order of this suggestion list. Do not claim that one small simulator satisfies a whole performance expectation.

## Site structure as it grows

Once a second lab is ready:

- Move this activity into `labs/balloon/`, preserving a redirect from its original entry point.
- Add a simple home page with cards describing each lab's question, time estimate, and status.
- Add a small `labs.json` registry with ID, title, path, subject, protocol version, and teacher-guide path.
- Share only stable styles, accessible controls, and report helpers in `shared/`.
- Keep each lab's model, state, question set, sources, and tests in its own directory.

The current release has one lab; no menu links pretend that future labs are already built.

## Repeatable development checklist

1. Read the actual source lab and list its essential observations, variables, data, and reasoning.
2. Make a source-to-simulator mapping. Identify which physical skills the model cannot replace.
3. Write a short, accurate model and unit convention. Check a numeric answer key against it.
4. Create brief student steps, worked examples using separate data, hints, and sentence frames.
5. Preserve student input and evidence collection. Make any generated data visibly model data.
6. Support keyboard navigation, large targets, reduced motion, readable contrast, and text/table alternatives.
7. Provide local saving, a portable work file, a printable report, and a teacher key.
8. Check the full workflow and relevant model properties, then review on a school device.
9. Ask the teacher to determine standards coverage and acceptable laboratory documentation.
10. Publish only original code and permitted materials. Keep educational records out of the repository.

## Storage and privacy

Give each lab a unique storage key and protocol version, such as `space-lab:epicenter:v1`. A file from one lab must not silently open as another lab. Handle incomplete and incompatible files with clear messages.

Retain the default of no account and no upload of student responses. A future classroom dashboard would be a separate feature requiring explicit design decisions about access, storage, deletion, and school policy.
