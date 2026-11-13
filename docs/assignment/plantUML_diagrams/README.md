# PlantUML Diagrams

This directory contains PlantUML exports generated from the Visual Paradigm
assignment project.

## Files

- `saasPlug_use_case_diagram.puml` - use case diagram for the main saasPlug
  actors and use cases.
- `saasPlug_interfaces__concept_.puml` - conceptual component/interface diagram.
- `saasPlug_interfaces_for_2025_2026_project.puml` - project-specific
  component/interface diagram.
- `saasPlug_status_update_overview.puml` - activity diagram for status update
  and reservation handling.
- `project_semantics_semantics.puml` - exported JSON metadata for model element
  descriptions. This is not a rendered UML diagram.

## Validation and rendering

Run the following commands from the **`ntua-saasplug` repository root**.
They use the PlantUML JAR from the canonical sibling
[PlantUML-VP reference repository](https://github.com/ntua-el21026/PlantUML-VP),
with this checkout layout:

```text
workspace/
  ntua-saasplug/
  PlantUML-VP/
    lib/plantuml.jar
```

With a Java runtime available, configure the JAR location and check the four
UML exports:

```bash
PLANTUML_JAR=../PlantUML-VP/lib/plantuml.jar
test -f "$PLANTUML_JAR"
java -jar "$PLANTUML_JAR" -checkonly docs/assignment/plantUML_diagrams/saasPlug_*.puml
```

If your JAR is installed elsewhere, set `PLANTUML_JAR` to that path instead.
The relative example assumes the working directory remains the application
repository root. The `saasPlug_*.puml` pattern selects the four UML exports;
`project_semantics_semantics.puml` remains the separate exported JSON metadata.

To render PNG previews from the same working directory and shell:

```bash
java -jar "$PLANTUML_JAR" -tpng docs/assignment/plantUML_diagrams/saasPlug_*.puml
```

Rendering component and use-case diagrams also requires Graphviz `dot` on the
system path. PNGs are generated beside the selected `.puml` inputs; keep the
original exports and Visual Paradigm project unchanged when reviewing them.

## Export Limitations

These files are useful text exports, but they are not a perfect 1:1 replacement
for the Visual Paradigm `.vpp` project:

- The Visual Paradigm data flow diagram is missing because the plugin does not
  support `DataFlowDiagram` export.
- Visual Paradigm-only cosmetic shapes may be dropped.
- The activity diagram may simplify shared final-node layout compared with the
  original Visual Paradigm rendering.

For exact layout and the full diagram set, open the source `.vpp` file in the
parent assignment directory.
