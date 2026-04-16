# Assignment Documentation

This directory contains the source material and generated artifacts for the
saasPlug assignment.

## Contents

- `SRS *.docx` - the main SRS document with embedded diagram images.
- `Project Notes from Lectures.docx` - supporting notes from lectures.
- `*.pdf` - the assignment statement.
- `*.vpp` - the Visual Paradigm source project for the diagrams.
- `plantUML_diagrams/` - PlantUML exports from the Visual Paradigm project.
- `providers/` - hypothetical provider API material, including Swagger/OpenAPI,
  YAML files, and Postman collections.

## Diagram Sources

The authoritative editable diagram source is the Visual Paradigm project:

```text
Diagrams SRS.vpp
```

The SRS document embeds rendered images of the diagrams. The PlantUML files in
`plantUML_diagrams/` are exported text versions intended for review, version
control, and regeneration.

## Known Export Notes

The PlantUML export is not a complete replacement for the Visual Paradigm
project:

- The exported UML diagrams are syntactically valid PlantUML.
- The Visual Paradigm data flow diagram is not exported because the installed
  PlantUML plugin does not support Visual Paradigm `DataFlowDiagram`.
- Some Visual Paradigm cosmetic/freeform shapes, such as standalone labels and
  decorative rectangles, may be omitted from the PlantUML output.
- `project_semantics_semantics.puml` is a JSON metadata sidecar emitted by the
  plugin, not a visual UML diagram.

Use the `.vpp` file when exact visual fidelity is required. Use the `.puml`
files when text-based review or regeneration is more useful.
