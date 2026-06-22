# ChatGPT PDF Prompt Transcriptions

This directory contains sequential Markdown transcriptions of complete,
near-complete, and explicitly speculative prompt-response records recoverable from
the PDF exports in `docs/ai/prompts_chatgpt/pdf/`.

Each numbered file contains exactly one prompt and its corresponding response.
For near-complete turns, text hidden behind the ChatGPT export label
`Εμφάνιση περισσότερων` is represented by an explicit omission marker. Hidden text is
not invented. Each file has a transcription note describing whether the source is
complete, clipped, collapsed, or supplemented from a matching repository artifact.

Some records use speculative reconstruction when the prompt is absent but the response
and surrounding turns make the user's intent clear. These files are explicitly labeled
`Speculative reconstruction` and include a confidence level. A record may also preserve
a visible prompt whose response is absent by using
`[Response unavailable in the PDF export.]`.

Possible credentials and secret-like values are redacted rather than copied into
versioned documentation.

## Included pairs

| File | Source PDF | Prompt page | Response pages |
|---|---|---:|---:|
| `prompt_001.md` | App Audit and Env Connection | 45 | 48-57 |
| `prompt_002.md` | App Audit and Env Connection | 62 | 62-74 |
| `prompt_003.md` | Initial Prompt, Specs, Repo Audit and Setup | 12 | 15-25 |
| `prompt_004.md` | App Audit - 2 and Docker Commands | 20 | 21-22 |
| `prompt_005.md` | App Audit - 2 and Docker Commands | 22 | 22-28 |
| `prompt_006.md` | App Audit - 2 and Docker Commands | 28 | 28-29 |
| `prompt_007.md` | App Build - Prompts 1-14 | 5 | 6-7 |
| `prompt_008.md` | App Build - Prompts 1-14 | 18 | 18-19 |
| `prompt_009.md` | App Build - Prompts 1-14 | 20 | 20-21 |
| `prompt_010.md` | App Build - Prompts 1-14 | 22 | 22-24 |
| `prompt_011.md` | App Build - Prompts 1-14 | 24-25 | 25-34 |
| `prompt_012.md` | App Audit and Env Connection | 12 | 12-32 |
| `prompt_013.md` | App Audit and Env Connection | 57-58 | 58-62 |
| `prompt_014.md` | App Audit and Env Connection | 75 | 75-80 |
| `prompt_015.md` | App Audit and Env Connection | 80 | 80-84 |
| `prompt_016.md` | App Audit and Env Connection | 84 | 84-95 |
| `prompt_017.md` | Initial Prompt, Specs, Repo Audit and Setup | 77 | 77-84 |
| `prompt_018.md` | Initial Prompt, Specs, Repo Audit and Setup | 84 | 84-86 |
| `prompt_019.md` | Initial Prompt, Specs, Repo Audit and Setup | 86 | 86-87 |
| `prompt_020.md` | Initial Prompt, Specs, Repo Audit and Setup | 87 | 87-89 |
| `prompt_021.md` | Initial Prompt, Specs, Repo Audit and Setup | inferred before 9 | 9-12 |
| `prompt_022.md` | App Build - Prompts 1-14 | inferred before 16 | 16-17 |
| `prompt_023.md` | App Audit and Env Connection | 33 | unavailable |
| `prompt_024.md` | App Audit and Env Connection | 34 | unavailable |
| `prompt_025.md` | App Audit and Env Connection | 35 | unavailable |
| `prompt_026.md` | App Audit and Env Connection | 36 | unavailable |
| `prompt_027.md` | App Audit and Env Connection | 39 | unavailable |
| `prompt_028.md` | App Audit and Env Connection | 42 | unavailable |
| `prompt_029.md` | App Audit and Env Connection | 43 | unavailable |

## PDF audit

### App Audit and Env Connection

Two complete pairs, five near-complete pairs, and seven prompt-only records were
included. Other turns were excluded because:

- the opening response has no preceding prompt in the export;
- some environment-configuration turns depend on screenshots or attachments whose
  contents are not recoverable from the PDF text layer.

### App Build - Prompts 1-14

Five near-complete pairs and one speculative high-confidence pair were included. The
opening prompt on page 1 remains excluded because most of its task body is hidden,
although a similar handoff appears elsewhere. The Prompt 01 result on pages 3-4 is
excluded because its corresponding assistant response is absent.

### Initial Prompt, Specs, Repo Audit and Setup

Four complete pairs, one near-complete pair, and one speculative high-confidence pair
were included. The initial prompt remains excluded because most of its task body is
collapsed and several materially different completions are plausible. The prompt
preceding the very long response beginning on page 26 remains excluded because the
response spans many architecture decisions and the exact user acceptance wording is
too uncertain for a reliable reconstruction.

### App Audit - 2 and Docker Commands

Three complete pairs were included. The long opening repository-review response has no
preceding prompt in the export and remains excluded.
