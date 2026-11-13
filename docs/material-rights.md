# Material rights and provenance

The root MIT license applies to the original saasPlug software and documentation
for which the named copyright holder can grant rights. It does not relicense
third-party publications or course materials. Preserve the root license, original
Git authorship, academic attribution, AI-assistance disclosure, and dependency
notices when reusing the software.

## Retained publications

The following PDFs are retained byte-for-byte under separate grants. No changes
were made to their text, notices, or authorship.

| Repository file | Attribution and source | Applicable permission |
|---|---|---|
| `lectures/bibliography/Paper_3-Impacts_of_Decomposition_Techniques.pdf` | Chaitanya K. Rudrabhatla (2020), *Impacts of Decomposition Techniques on Performance and Latency of Microservices*, IJACSA 11(8), [DOI 10.14569/IJACSA.2020.0110803](https://doi.org/10.14569/IJACSA.2020.0110803), [publisher record](https://thesai.org/Publications/ViewPaper?Volume=11&Issue=8&Code=IJACSA&SerialNo=3). | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), explicitly stated by the publisher. Retain attribution and license link; identify changes in any derivative. |
| `lectures/bibliography/Paper_4-Comparison_of_Event_Choreography.pdf` | Chaitanya K. Rudrabhatla (2018), *Comparison of Event Choreography and Orchestration Techniques in Microservice Architecture*, IJACSA 9(8), [DOI 10.14569/IJACSA.2018.090804](https://doi.org/10.14569/IJACSA.2018.090804), [publisher record](https://thesai.org/Publications/ViewPaper?Volume=9&Issue=8&Code=IJACSA&SerialNo=4). | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), explicitly stated by the publisher. Retain attribution and license link; identify changes in any derivative. |
| `lectures/7.4 Extra - 2.pdf` | Charalampos Kampougeris (2025), *A Comparative Study of Model-First API Design Frameworks and a Methodology for Endpoint Interdependency Analysis*, NTUA diploma thesis, supervised by Vassilios Vescoukis. | The copyright notice on PDF page 4 permits reproduction, storage, and distribution for nonprofit educational or research purposes with source citation and retained copyright notice. This academic software archive uses that permission. Commercial exploitation requires the author's permission. The thesis is not MIT-licensed. |

The two IJACSA PDFs match the publisher-hosted files by SHA-256 and byte size.
Their fingerprints and the thesis fingerprint are in
[material provenance](material-provenance.json). Publisher terms were checked on
13 November 2026.

## Omitted reference material

The exact historical path inventory and fingerprints are recorded in
[material provenance](material-provenance.json). Exclusions cover:

- Fox and Patterson's *Engineering Software as a Service*, version 2.0b7:
  its frontmatter expressly requires copyright-holder permission for digital or
  printed redistribution, including nonprofit redistribution. Use the
  [official book and teaching-material site](https://saasbook.info/) for access.
- Institutionally authored lecture PDFs, slide-image exports, assignment/SRS
  source files and their mechanical Visual Paradigm/PlantUML exports, and supplied
  provider API documents: no applicable public redistribution grant was located.
  The [official NTUA course record](https://www.ece.ntua.gr/en/education/undergraduate/courses?courseId=3399)
  links to [Helios](https://helios.ntua.gr/course/view.php?id=1015), which requires
  authorized course access. This is a permission gap, not a documented ban on
  publishing original student implementations.
- The instructor's architecture-material ZIP, including `materials/rag1.pdf`,
  identified as chapter 2 of Chris Richardson's *Microservices Patterns* (Manning,
  2018), and instructor prompts/demo requirements. No redistribution permission
  for those copies was located. See the [publisher's book record](https://www.manning.com/books/microservices-patterns)
  and [eBook terms](https://www.manning.com/ebook-license).
- *Enhancing API documentation by inter-endpoint dependency graphs* (2025), by
  Panagiotis Papadeas, Dimitrios Gerokonstantis, Christos Hadjichristofi, and
  Vassilios Vescoukis, DOI [10.15439/2025F8035](https://doi.org/10.15439/2025F8035):
  the [official proceedings record](https://annals-csis.org/Volume_43/drp/8035.html)
  provides reading access, but no applicable redistribution grant was located.

Original student lecture notes, accepted specifications, original intermediate
and final diagrams, application code, tests, and project AI prompt/run records
are retained. Their references to omitted course material document provenance;
they do not supply those files or grant rights to them. The reviewed AI archives
contain project prompts and responses rather than an additional textbook copy.

## Reproducibility and history clearance

The omitted teaching references are not loaded by the application, Docker build
steps, offline configuration tests, or local application Postman scripts.
Provider adapters retain their original request/response implementations and
mocked contract tests. Live provider operation still requires authorized course
network access and independently configured keys. This rights preparation does
not qualify or execute the runtime.

The owner's private original repository and evidence are preserved. Removing
files from a source tree is insufficient to clear earlier revisions. Publication
requires an explicitly authorized rewrite of every affected public ref and
verification that old restricted objects and historical paths cannot be retrieved
from the hosting service. Provider caches may retain old commit access; successful
force-push alone does not establish clearance. Permission for a hosted copy or a
provider-supported removal outcome remains necessary if old restricted material
is still retrievable. This document does not assert that publication or provider
cleanup has occurred.
