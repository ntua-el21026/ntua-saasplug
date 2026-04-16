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

## Validation

The `.puml` files can be syntax-checked with the PlantUML jar bundled in the
Visual Paradigm plugin:

```bash
java -jar /home/peppasmich/PlantUML-VP/lib/plantuml.jar -checkonly *.puml
```

To render PNG images:

```bash
java -jar /home/peppasmich/PlantUML-VP/lib/plantuml.jar -tpng *.puml
```

Rendering component and use case diagrams requires Graphviz `dot` to be
available on the system path. If PlantUML reports that `dot` is missing, install
Graphviz and rerun the render command.

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
