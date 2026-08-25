import { openDialogResult } from "@/components/dialogs";
import { sectionsApi } from "@/features/sources/api";
import { CitationDialog } from "@/features/sources/dialogs/citation-dialog";
import { CreateSourceDialog } from "@/features/sources/dialogs/create-source-dialog";
import { CreateSectionDialog } from "@/features/sources/dialogs/create-section-dialog";
import { CreateCaptureDialog } from "@/features/captures/components/create-capture-dialog";
import type { SourceDTO, SourceSectionDTO } from "@/features/sources/types";
import { routes } from "@/lib/routes";
import type { AppRouter } from "@/lib/nav";
import { pickSectionOption } from "../pickers/pick-section-option";
import { pickSourceOption } from "../pickers/pick-source-option";

interface RunCreateCitationFlowArgs {
  allSources: SourceDTO[];
  source?: SourceDTO;
  sections?: SourceSectionDTO[];
  sourceId?: number;
  currentSectionId?: string;
}

export async function runCreateCitationFlow({
  allSources,
  source,
  sections = [],
  sourceId,
  currentSectionId,
}: RunCreateCitationFlowArgs) {
  if (source && sourceId) {
    if (currentSectionId) {
      if (currentSectionId === "unsorted") {
        openDialogResult(CitationDialog, { mode: "create", flow: "manual", sourceId });
        return;
      }

      const sectionId = Number(currentSectionId);
      const currentSection = sections.find((item) => item.id === sectionId);
      openDialogResult(CitationDialog, { mode: "create", flow: "manual", sourceId, sectionId, sectionTitle: currentSection?.title });
      return;
    }

    const pickedSection = await pickSectionOption({
      heading: source.title
        ? `Create Citation: Select Section in "${source.title}"`
        : "Create Citation: Select Section",
      sections,
      unassignedLabel: "No Section (Unsorted)",
      unassignedDescription: "Create citation without a section",
    });

    if (pickedSection.kind === "cancel" || pickedSection.kind === "back") {
      return;
    }

    if (pickedSection.kind === "unassigned") {
      openDialogResult(CitationDialog, { mode: "create", flow: "manual", sourceId });
      return;
    }

    if (pickedSection.kind === "create") {
      const result = await openDialogResult(CreateSectionDialog, { source });
      if (result.kind !== "success" || !result.value) return;
      openDialogResult(CitationDialog, { mode: "create", flow: "manual", sourceId, sectionId: result.value.id });
      return;
    }

    openDialogResult(CitationDialog, { mode: "create", flow: "manual", sourceId, sectionId: pickedSection.section.id });
    return;
  }

  const pickedSource = await pickSourceOption({
    heading: "Create Citation: Select Source",
    sources: allSources,
  });

  if (pickedSource.kind === "cancel") return;

  if (pickedSource.kind === "create") {
    const result = await openDialogResult(CreateSourceDialog, { redirectOnCreate: false });
    if (result.kind !== "success" || !result.value) return;
    openDialogResult(CitationDialog, { mode: "create", flow: "manual", sourceId: result.value });
    return;
  }

  try {
    const fetchedSections = await sectionsApi.getSections(pickedSource.source.id!);
    await runCreateCitationFlow({ allSources, source: pickedSource.source, sections: fetchedSections, sourceId: pickedSource.source.id });
  } catch (error) {
    console.error("Failed to load sections for source:", error);
    await runCreateCitationFlow({ allSources, source: pickedSource.source, sections: [], sourceId: pickedSource.source.id });
  }
}

interface RunCreateCaptureFlowArgs {
  allSources: SourceDTO[];
  source?: SourceDTO;
  sourceId?: number;
  currentSectionId?: string;
  sections?: SourceSectionDTO[];
}

export async function runCreateCaptureFlow({
  allSources,
  source,
  sourceId,
  currentSectionId,
  sections = [],
}: RunCreateCaptureFlowArgs) {
  if (source && sourceId) {
    if (currentSectionId) {
      if (currentSectionId === "unsorted") {
        openDialogResult(CreateCaptureDialog, { sourceId, sourceTitle: source.title });
        return;
      }

      const sectionId = Number(currentSectionId);
      const currentSection = sections.find((item) => item.id === sectionId);
      openDialogResult(CreateCaptureDialog, { sourceId, sourceTitle: source.title, sectionId, sectionTitle: currentSection?.title });
      return;
    }

    const pickedSection = await pickSectionOption({
      heading: source.title
        ? `Add Comment: Select Section in "${source.title}"`
        : "Add Comment: Select Section",
      sections,
      unassignedLabel: "No Section (Unsorted)",
      unassignedDescription: "Create comment without a section",
    });

    if (pickedSection.kind === "cancel" || pickedSection.kind === "back") return;

    if (pickedSection.kind === "unassigned") {
      openDialogResult(CreateCaptureDialog, { sourceId, sourceTitle: source.title });
      return;
    }

    if (pickedSection.kind === "create") {
      const result = await openDialogResult(CreateSectionDialog, { source });
      if (result.kind !== "success" || !result.value) return;
      openDialogResult(CreateCaptureDialog, { sourceId, sourceTitle: source.title, sectionId: result.value.id, sectionTitle: result.value.title });
      return;
    }

    openDialogResult(CreateCaptureDialog, { sourceId, sourceTitle: source.title, sectionId: pickedSection.section.id, sectionTitle: pickedSection.section.title });
    return;
  }

  const pickedSource = await pickSourceOption({
    heading: "Add Comment: Select Source",
    sources: allSources,
  });

  if (pickedSource.kind === "cancel") return;

  if (pickedSource.kind === "create") {
    const result = await openDialogResult(CreateSourceDialog, { redirectOnCreate: false });
    if (result.kind !== "success" || !result.value) return;
    openDialogResult(CreateCaptureDialog, { sourceId: result.value });
    return;
  }

  try {
    const fetchedSections = await sectionsApi.getSections(pickedSource.source.id!);
    await runCreateCaptureFlow({ allSources, source: pickedSource.source, sourceId: pickedSource.source.id, sections: fetchedSections });
  } catch (error) {
    console.error("Failed to load sections for source:", error);
    await runCreateCaptureFlow({ allSources, source: pickedSource.source, sourceId: pickedSource.source.id, sections: [] });
  }
}

interface RunNavigateToSectionFlowArgs {
  router: AppRouter;
  source: SourceDTO;
  sections: SourceSectionDTO[];
}

export async function runNavigateToSectionFlow({ router, source, sections }: RunNavigateToSectionFlowArgs) {
  const pickedSection = await pickSectionOption({
    heading: source.title ? `Go to Section in "${source.title}"` : "Go to Section",
    sections,
    unassignedLabel: "Unsorted",
    unassignedDescription: "Open uncategorized highlights and notes",
  });

  if (pickedSection.kind === "cancel" || pickedSection.kind === "back" || pickedSection.kind === "create") {
    return;
  }

  if (pickedSection.kind === "unassigned") {
    router.push(routes.sourceSectionUnsorted(source.id));
    return;
  }

  router.push(routes.sourceSection(source.id, pickedSection.section.id));
}
